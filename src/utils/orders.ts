import { BigNumber, ethers } from 'ethers'

import type {
  APIOptionOrderEntry,
  APIOptionOrderParams,
  APIOptionOrderResponse,
  OptionOrder
} from '../types/Post'
import type {
  SmartContractOptionOrderParams,
  UserPosition
} from '../types/option'
import type { AppVersion } from '../types/general'
import { ArrowApiUrls } from '../types/api'
import type { OrderStatusResponse } from '../types/Get'
import { quantityScaleFactor } from '../constants'
import { Network } from '../common/types/general'
import type { Option } from '../common/arrow-common'
import { PositionStrategyType, OrderType } from '../common/types/option'
import {
  determinePositionStrategyType,
  convertToGeneralPositionType
} from '../common/utils/parsing'
import { getUnderlierSpotPrice } from '../common/utils/pricing'
import {
  prepareOrderForSubmission,
  prepareOrderQuantity,
  prepareStrikes
} from './parsing'
import { GET, POST } from './axios'
import {
  eip712SignOptionOrderMessage,
  getArrowOptionsContract,
  getRFQStablecoinContract,
  getRegistryContract,
  getUserFundsManagerContract,
  waitTransaction
} from './web3'
import { calculateThresholdPrice, getBulkRFQOptionPrice } from './pricing'
import {
  convertUnixToNanoseconds,
  getExpirationTimestamps,
  getSignatureTimestamps
} from './time'

export async function submitRFEOrder(
  orderParameters: APIOptionOrderEntry[],
  appVersion: AppVersion,
  networkVersion: Network,
  useTradingCredits: boolean | undefined = undefined
): Promise<{ orderId: string }> {
  try {
    const url = ArrowApiUrls[appVersion][networkVersion]

    const requestBody: APIOptionOrderParams = {
      option_orders_list: orderParameters,
      use_trading_credits: useTradingCredits || false
    }

    const { data: response } = await POST<
      APIOptionOrderParams,
      APIOptionOrderResponse
    >(url + '/options/order', requestBody)

    const { order_id } = response

    return { orderId: order_id }
  } catch (error: any) {
    if (error.response && error.response.data) {
      const { message, trace_id, status_code, exception_type } =
        error.response.data

      throw {
        apiError: true,
        message,
        trace_id,
        status_code,
        exception_type,
        originalError: error
      }
    }
    // If it's not an API error, rethrow the original error
    throw error
  }
}

/**
 * Retrieves the order parameters for a given set of option legs.
 * The order parameters are used to sign the order and to verify the order on-chain.
 * This function does not submit the order to the blockchain, but rather prepares the order for submission.
 * The order is submitted to the blockchain using the submitOrder function.
 *
 * @param optionLegs - An array of Option objects representing the legs of the order.
 * @param openingPosition - A boolean indicating whether it's an opening position (true) or a closing position (false).
 * @param deadline - A unix timestamp indicating the user defined transaction deadline
 * @param slippage - The slippage percentage for the order.
 * @param version - The version of the contract (optional, defaults to DEFAULT_VERSION).
 * @param wallet - The wallet or signer object used to sign the order.
 * @returns An array of objects containing the order parameters.
 */
export async function getOrderParameters(
  orders: UserPosition[],
  transactionDeadline: number,
  openingPosition: boolean,
  slippage: number,
  wallet: ethers.Wallet | ethers.providers.JsonRpcSigner,
  networkVersion: Network,
  appVersion: AppVersion,
  device = '',
  mode = ''
): Promise<{
  preparedParameters: APIOptionOrderEntry[]
  bigNumberThresholdPrice: BigNumber
  thresholdPrice: number
  amountToApprove: BigNumber
}> {
  const isMultiAtomOrder = orders.length > 1

  // Get stablecoin decimals
  const stablecoinDecimals = await (
    await getRFQStablecoinContract(networkVersion, appVersion, wallet)
  ).decimals()

  const optionOrders: OptionOrder[] = []

  let totalBigNumberThresholdPrice: BigNumber = BigNumber.from(0)
  let totalThresholdPrice = 0
  let totalAmountToApprove: BigNumber = BigNumber.from(0)

  const registryContract = await getRegistryContract(networkVersion, appVersion)
  const feeRateDecimal = await registryContract.feeRateDecimals()
  const feeRate = await registryContract.feeRate()
  const arrowFee = feeRate / 10 ** feeRateDecimal.toNumber()

  await Promise.all(
    orders.map(async (position, index) => {
      // Determine if the option legs form a known strategy
      const singlePositionAtomType = determinePositionStrategyType(
        position.options
      )

      const isSingleAtomLong = [
        PositionStrategyType.CALL_DEBIT_SPREAD,
        PositionStrategyType.PUT_DEBIT_SPREAD,
        PositionStrategyType.LONG_CALL,
        PositionStrategyType.LONG_PUT
      ].includes(singlePositionAtomType)

      let isBuying = true
      let orderType = OrderType.OPEN_LONG

      if (isMultiAtomOrder) {
        const combinedOption: Option[] = orders.flatMap(order => order.options)

        const multiAtomStrategy = determinePositionStrategyType(combinedOption)

        if (multiAtomStrategy === PositionStrategyType.CUSTOM) {
          // TODO - This assumes we cleaned input to have all longs or all shorts for custom order
          orderType = combinedOption[index].orderType
        } else {
          if (isSingleAtomLong) {
            isBuying = openingPosition
            orderType = isBuying ? OrderType.OPEN_LONG : OrderType.CLOSE_LONG
          } else {
            isBuying = !openingPosition
            orderType = isBuying ? OrderType.CLOSE_SHORT : OrderType.OPEN_SHORT
          }
        }
      } else {
        if (isSingleAtomLong) {
          isBuying = openingPosition
          orderType = isBuying ? OrderType.OPEN_LONG : OrderType.CLOSE_LONG
        } else {
          isBuying = !openingPosition
          orderType = isBuying ? OrderType.CLOSE_SHORT : OrderType.OPEN_SHORT
        }
      }

      const positionStrategy = convertToGeneralPositionType(
        singlePositionAtomType
      )

      // Parse strikes
      const { strikesString, bigNumberStrikes } = prepareStrikes(
        position.options,
        positionStrategy,
        stablecoinDecimals
      )

      // Parse expiration
      const { bigNumberExpirationTimestamp } = getExpirationTimestamps(
        position.options[0].readableExpiration
      )

      // Parse quantity (Assumes all legs of order have the same quantity)
      const bigNumberOrderQuantity = prepareOrderQuantity(
        position.options[0].quantity
      )

      const optionPriceRequest = await getBulkRFQOptionPrice(
        position.options,
        appVersion,
        networkVersion
      )

      const spotPrice = await getUnderlierSpotPrice(position.options[0].ticker)

      const {
        bigNumberThresholdPrice,
        thresholdPrice,
        preparedAmountToApprove: amountToApprove
      } = calculateThresholdPrice(
        isBuying,
        position.options[0].quantity,
        optionPriceRequest.totalCostOfOptions,
        slippage,
        arrowFee,
        stablecoinDecimals,
        spotPrice
      )

      totalBigNumberThresholdPrice = totalBigNumberThresholdPrice.add(
        bigNumberThresholdPrice
      )
      totalThresholdPrice += thresholdPrice
      totalAmountToApprove = totalAmountToApprove.add(amountToApprove)

      const { signatureTimestamp, bigNumberSignatureTimestamp } =
        getSignatureTimestamps()

      const orderParams: SmartContractOptionOrderParams = {
        ticker: position.options[0].ticker,
        longFlag: [OrderType.OPEN_LONG, OrderType.CLOSE_LONG].includes(
          orderType
        ),
        expiration: bigNumberExpirationTimestamp,
        arrayOfStrikes: bigNumberStrikes,
        strikesString: strikesString,
        positionStrategy: positionStrategy,
        orderQuantity: bigNumberOrderQuantity,
        thresholdPrice: bigNumberThresholdPrice,
        signatureTimestamp: bigNumberSignatureTimestamp
      }

      const signature = await eip712SignOptionOrderMessage(
        orderParams,
        wallet,
        networkVersion,
        appVersion
      )

      const order: OptionOrder = {
        options: position.options,
        orderType: orderType,
        positionId: position.positionId,
        quantity: position.options[0].quantity,
        senderAddress: await wallet.getAddress(),
        signature: signature,
        signatureTimestamp: signatureTimestamp,
        transactionDeadline: convertUnixToNanoseconds(transactionDeadline),
        threshold_price: thresholdPrice
      }

      optionOrders.push(order)
    })
  )

  const preparedParameters = prepareOrderForSubmission(
    optionOrders,
    networkVersion,
    device,
    mode
  )

  return {
    preparedParameters,
    bigNumberThresholdPrice: totalBigNumberThresholdPrice,
    thresholdPrice: totalThresholdPrice,
    amountToApprove: totalAmountToApprove
  }
}

/**
 * Approve spending if the user has enough allowance.
 * If the allowance is sufficient, approve; otherwise, do nothing.
 *
 * @param amountToApprove - The amount to approve for spending.
 * @param networkVersion - The network version.
 * @param wallet - The user's wallet.
 */
export async function approveSpending(
  amountToApprove: BigNumber,
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.Wallet | ethers.providers.JsonRpcSigner
) {
  const stablecoin = await getRFQStablecoinContract(
    networkVersion,
    appVersion,
    wallet
  )
  const fundsManager = await getUserFundsManagerContract(
    networkVersion,
    appVersion,
    wallet
  )

  const allowance = await stablecoin.allowance(
    await wallet.getAddress(),
    fundsManager.address
  )

  // If the current allowance is less than the required allowance,
  // approve the spending by increasing the allowance.
  if (allowance.lt(amountToApprove)) {
    const approvalTx = await stablecoin.approve(
      fundsManager.address,
      amountToApprove
    )

    // Wait for the approval transaction to be mined.
    waitTransaction(approvalTx.hash, networkVersion)
  }
}

/**
 * Deposit gas fee amount into the user's account if the balance is not sufficient.
 *
 * @param accountAddress - The address of the user's account.
 * @param networkVersion - The network version.
 * @param wallet - The user's wallet.
 * @param transactionCost - Optional parameter to specify the threshold for depositing.
 * @param amountToDeposit - Optional parameter to specify the amount to deposit.
 */
export async function depositGasFee(
  accountAddress: string,
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.Wallet | ethers.providers.JsonRpcSigner,
  transactionCost?: string,
  amountToDeposit = '0.03'
) {
  const fundsManager = await getUserFundsManagerContract(
    networkVersion,
    appVersion,
    wallet
  )

  // Check the current balance using fundsManager.gasPaid(accountAddress)
  const currentBalance = await fundsManager.gasPaid(accountAddress)

  // Calculate the threshold based on the optional transactionCost parameter
  const threshold = transactionCost
    ? ethers.utils.parseEther(transactionCost)
    : ethers.utils.parseEther('0.03')

  // Compare the balance with the threshold
  if (currentBalance.lt(threshold)) {
    const depositAmountBigNumber = ethers.utils.parseEther(amountToDeposit)
    // Deposit the gas fee using fundsManager.depositGasFee(accountAddress, amountToDeposit)
    const depositTx = await fundsManager.depositGasFee(accountAddress, {
      value: depositAmountBigNumber
    })

    // TODO Replace with custom polling function
    waitTransaction(depositTx.hash, networkVersion)
  }
}

export async function transferPosition(
  toAddress: string,
  tokenId: number,
  amount: number,
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.Wallet
) {
  try {
    const arrowOptionContract = await getArrowOptionsContract(
      networkVersion,
      appVersion,
      wallet
    )

    const res = await arrowOptionContract.transferPosition(
      toAddress,
      tokenId,
      Math.round(amount * quantityScaleFactor)
    )

    return res
  } catch (error) {
    // Handle errors appropriately
    console.error('Error while depositing gas fee:', error)
  }
}

export async function getRFQTransactionStatus(
  orderId: string,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion]
  const orderStatusResponse = await GET<OrderStatusResponse>(
    apiUrl + '/options/transaction-status',
    {
      params: {
        order_id: orderId,
        chain_id: networkVersion === Network.Testnet ? 43113 : 43114
      }
    }
  )

  return {
    orderStatus: orderStatusResponse.data.transaction_status,
    ticker: orderStatusResponse.data.ticker,
    executionPrice: orderStatusResponse.data.execution_price,
    transactionHash: orderStatusResponse.data.transaction_hash
  }
}

export async function updateRFQTransactionStatus(
  orderId: string,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion]
  const orderStatusResponse = await GET<OrderStatusResponse>(
    apiUrl + '/options/update-transaction-status',
    {
      params: {
        order_id: orderId,
        chain_id: networkVersion === Network.Testnet ? 43113 : 43114
      }
    }
  )

  return {
    orderStatus: orderStatusResponse.data.transaction_status,
    ticker: orderStatusResponse.data.ticker,
    executionPrice: orderStatusResponse.data.execution_price,
    transactionHash: orderStatusResponse.data.transaction_hash
  }
}
