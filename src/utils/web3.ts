import { BigNumber, ethers } from 'ethers'
import type { TransactionReceipt } from '@ethersproject/abstract-provider/lib/index'
import {
  AvalancheMainnetABIs,
  AvalancheFujiContestABIs,
  AvalancheFujiTestnetABIs
} from '../abis'
import type {
  MarketMakerOrderParams,
  SmartContractOptionOrderParams
} from '../types/option'
import { AppVersion } from '../types/general'
import type { PollingOptions } from '../types/web3'
import {
  ArrowRouterAddresses,
  ArrowStakingAddresses,
  ArrowTokenAddresses,
  ChainIds,
  providers
} from '../types/web3'
import { ArrowApiUrls } from '../types/api'
import type { NFTMarketMakerData } from '../types/Get'
import { OrderType, PositionStrategy } from '../common/types/option'
import { Network } from '../common/types/general'
import { getTimeUTC } from '../common/utils/time'
import { getBigNumberNanoSecFromSec, getExpirationTimestamps } from './time'
import { getDecimalStrikeString, prepareOrderQuantity } from './parsing'
import { GET } from './axios'

/**
 * Get the stablecoin contract that is associated with Arrow's contract suite.
 *
 * @param networkVersion Version of Arrow contract suite with which to interact. Default is V5.
 * @param wallet Wallet with which you want to connect the instance of the stablecoin contract. Default is Fuji provider.
 * @returns Local instance of ethers.Contract for the stablecoin contract.
 */
export async function getRFQStablecoinContract(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet?: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  let provider = wallet

  if (!provider) {
    provider = providers[networkVersion]
  }

  // Get the stablecoin contract address from the registry contract
  const stablecoinContractAddress = await (
    await getRegistryContract(networkVersion, appVersion)
  ).stablecoinAddress()

  // Create and return an instance of the stablecoin contract
  const stablecoin = new ethers.Contract(
    stablecoinContractAddress,
    ABIInterface.StablecoinABI,
    provider
  )

  return stablecoin
}

/**
 * Get the router contract associated with Arrow's contract suite.
 *
 * @param networkVersion Version of Arrow contract suite with which to interact.
 * @param wallet Wallet with which you want to connect the instance of the router contract.
 * @returns Local instance of ethers.Contract for the router contract.
 */
export function getRouterContract(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet?: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  // Determine the router contract address based on the network version and app version
  const routerContractAddress =
    ArrowRouterAddresses[appVersion][networkVersion]!

  // Create and return an instance of the router contract using the abi
  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  return new ethers.Contract(
    routerContractAddress,
    ABIInterface.ArrowRouterABI,
    wallet || providers[networkVersion]
  )
}

export async function getRFQEventContract(
  networkVersion: Network,
  appVersion: AppVersion
) {
  // Determine the router contract address based on the network version and app version
  const eventsAddress = await (
    await getRegistryContract(networkVersion, appVersion)
  ).eventsAddress()

  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  return new ethers.Contract(
    eventsAddress,
    ABIInterface.ArrowEventsABI,
    providers[networkVersion]
  )
}

/**
 * Get the registry contract associated with Arrow's contract suite.
 *
 * @param networkVersion Version of Arrow contract suite with which to interact.
 * @param wallet Wallet with which you want to connect the instance of the registry contract.
 * @returns Local instance of ethers.Contract for the registry contract.
 */
export async function getRegistryContract(
  networkVersion: Network,
  appVersion: AppVersion
) {
  // Get the registry address from the router contract
  const registryAddress = await getRouterContract(
    networkVersion,
    appVersion
  ).getRegistryAddress()

  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  // Create and return an instance of the registry contract
  return new ethers.Contract(
    registryAddress,
    ABIInterface.ArrowRegistryABI,
    providers[networkVersion]
  )
}

/**
 * Get the user funds manager contract associated with Arrow's contract suite.
 *
 * @param networkVersion Version of Arrow contract suite with which to interact.
 * @param wallet Wallet with which you want to connect the instance of the user funds manager contract.
 * @returns Local instance of ethers.Contract for the user funds manager contract.
 */
export async function getUserFundsManagerContract(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  // Get the user funds manager address from the registry contract
  const userFundsManagerAddress = await (
    await getRegistryContract(networkVersion, appVersion)
  ).userFundsManagerAddress()

  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  // Create and return an instance of the user funds manager contract
  return new ethers.Contract(
    userFundsManagerAddress,
    ABIInterface.UserFundsManagerABI,
    wallet
  )
}

/**
 * Retrieves an instance of the PositionsManager contract based on the network version and wallet.
 * @param networkVersion The network version to operate on.
 * @param wallet The wallet or provider instance for interacting with the blockchain.
 * @returns An instance of the PositionsManager contract.
 */
export async function getPositionsManagerContract(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
): Promise<ethers.Contract> {
  // Get the PositionsManager address from the registry contract
  const positionsManagerAddress = await (
    await getRegistryContract(networkVersion, appVersion)
  ).getPositionManagerAddress()

  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  // Create and return an instance of the PositionsManager contract
  return new ethers.Contract(
    positionsManagerAddress,
    ABIInterface.PositionsManagerABI, // Make sure PositionsManagerABI is defined
    wallet
  )
}

/**
 * Retrieves an instance of the Arrow Options contract for a specific network and application version.
 *
 * @param {Network} networkVersion - The network version for the contract interaction.
 * @param {AppVersion} appVersion - The version of the application.
 * @returns {Promise<ethers.Contract>} An instance of the Arrow Options contract.
 *
 * @throws {Error} Throws an error if the provided application version and network version are not compatible.
 *
 * @example
 * const networkVersion = Network.Mainnet;
 * const appVersion = AppVersion.V1;
 *
 * try {
 *   const arrowOptionsContract = await getArrowOptionsContract(networkVersion, appVersion);
 *   console.log('Arrow Options Contract:', arrowOptionsContract);
 * } catch (error) {
 *   console.error('Error obtaining Arrow Options Contract:', error.message);
 * }
 */
export async function getArrowOptionsContract(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
): Promise<ethers.Contract> {
  // Get the PositionsManager address from the registry contract
  const arrowOptionsAddress = await (
    await getRegistryContract(networkVersion, appVersion)
  ).optionsAddress()

  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  // Create and return an instance of the PositionsManager contract
  return new ethers.Contract(
    arrowOptionsAddress,
    ABIInterface.ArrowOptionABI,
    wallet
  )
}

/**
 * Signs an Option Order message using EIP-712 standard.
 * @param orderParameters - The parameters of the Option Order.
 * @param wallet - The wallet used to sign the message.
 * @returns The signature of the signed message.
 */
export async function eip712SignOptionOrderMessage(
  orderParameters: SmartContractOptionOrderParams,
  wallet: ethers.Wallet | ethers.providers.JsonRpcSigner,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const verifyingContractAddress = await (
    await getRegistryContract(networkVersion, appVersion)
  ).optionsAddress()

  const domain = {
    name: 'Arrow',
    chainId: ChainIds[networkVersion],
    verifyingContract: verifyingContractAddress,
    version: '1.0'
  }

  const dataType = {
    Param: [
      { name: 'longFlag', type: 'bool' },
      { name: 'ticker', type: 'string' },
      { name: 'expiration', type: 'uint256' },
      { name: 'strike1', type: 'uint256' },
      { name: 'strike2', type: 'uint256' },
      { name: 'decimalStrike', type: 'string' },
      { name: 'contractType', type: 'uint256' },
      { name: 'quantity', type: 'uint256' },
      { name: 'thresholdPrice', type: 'uint256' },
      { name: 'signatureTimestamp', type: 'uint256' }
    ]
  }

  const message = {
    longFlag: orderParameters.longFlag,
    ticker: orderParameters.ticker,
    expiration: orderParameters.expiration,
    strike1: orderParameters.arrayOfStrikes[0],
    strike2: orderParameters.arrayOfStrikes[1],
    decimalStrike: orderParameters.strikesString,
    contractType: orderParameters.positionStrategy,
    quantity: orderParameters.orderQuantity,
    thresholdPrice: orderParameters.thresholdPrice,
    signatureTimestamp: orderParameters.signatureTimestamp
  }

  const signature = await wallet._signTypedData(domain, dataType, message)

  return signature
}

/**
 * Generates a market maker's digital signature for given order parameters using the provided wallet.
 *
 * @param orderParams - The order parameters for which the signature needs to be generated.
 * @param wallet - The ethers Wallet instance used to sign the message.
 * @param networkVersion - The network version for which stablecoin decimals should be fetched.
 * @returns A Promise containing the generated digital signature.
 *
 * @throws Throws an error if signing the message fails.
 *
 * @example
 * const orderParams: MarketMakerOrderParams = {
 *   ticker: 'ETH',
 *   expiration: 07232023, // Readable Expiration timestamp
 *   strikes: [4000000000, 4200000000],
 *   contract_type: 0,
 *   quantity: 10,
 *   option_price: 100,
 *   market_maker_signature_timestamp: 1671842596000000000, // Signature timestamp in unix
 *   market_maker_deadline_timestamp: 1721376000000000000, // Deadline timestamp in unix
 * };
 * const wallet = new ethers.Wallet(privateKey);
 * const networkVersion = 'mainnet'; // Replace with the actual network version
 * const signature = await generateMarketMakerSignature(orderParams, wallet, networkVersion);
 * console.log('Generated Signature:', signature);
 */
export async function generateMarketMakerSignature(
  orderParams: MarketMakerOrderParams,
  wallet: ethers.Wallet,
  networkVersion: Network,
  appVersion: AppVersion
): Promise<string> {
  const decimals = await (
    await getRFQStablecoinContract(networkVersion, appVersion, wallet)
  ).decimals()

  const {
    ticker,
    expiration,
    strikes,
    contract_type,
    quantity,
    option_price,
    market_maker_signature_timestamp,
    market_maker_deadline_timestamp
  } = orderParams

  const positionParameterHash = ethers.utils.solidityKeccak256(
    [
      'string',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256'
    ],
    [
      ticker,
      getExpirationTimestamps(expiration).bigNumberExpirationTimestamp,
      ethers.utils.parseUnits(strikes[0].toString(), decimals),
      ethers.utils.parseUnits(strikes[1].toString(), decimals),
      contract_type,
      prepareOrderQuantity(quantity),
      ethers.utils.parseUnits(option_price.toString(), decimals),
      getBigNumberNanoSecFromSec(
        BigNumber.from(market_maker_signature_timestamp)
      ),
      getBigNumberNanoSecFromSec(
        BigNumber.from(market_maker_deadline_timestamp)
      )
    ]
  )

  const signature = await wallet.signMessage(
    ethers.utils.arrayify(positionParameterHash)
  )

  return signature
}

/**
 * Settle an options position for a specific owner, ticker, expiration, and strikes.
 *
 * @param {string} owner - The owner's address for the options position.
 * @param {Ticker} underlierTicker - The ticker symbol of the underlyer.
 * @param {number} expiration - The expiration timestamp for the option in nano seconds. 8 AM UTC.
 * @param {number[]} strikes - An array of strike prices for the option.
 * @param {PositionStrategy} positionStrategy - The position strategy for the option.
 * @param {string} marketMaker - The address of the market maker for the option.
 * @param {ethers.Wallet | ethers.providers.JsonRpcSigner} wallet - The wallet or signer to use for the transaction.
 * @param {Network} networkVersion - The network version for the transaction.
 * @param {AppVersion} appVersion - The version of the application.
 * @returns {Promise<void>} A promise that resolves when the settlement transaction is successful.
 *
 * @throws {Error} Throws an error if settlement fails.
 *
 * @example
 * const owner = "0x123456789abcdef";
 * const underlierTicker = "Ticker.ETH";
 * const expiration = 1698220800; // Wed Oct 25 2023 08:00:00 GMT+0000
 * const strikes = [3500];
 * const positionStrategy = PositionStrategy.CALL;
 * const marketMaker = "0xabcdef123456789";
 * const wallet = ethers.Wallet.createRandom();
 * const networkVersion = Network.Testnet;
 * const appVersion = AppVersion.RFQ;
 *
 * try {
 *   await settlePerOption(owner, ticker, expiration, strikes, positionStrategy, marketMaker, wallet, networkVersion, appVersion);
 *   console.log("Option settlement successful.");
 * } catch (error) {
 *   console.error("Option settlement failed:", error.message);
 * }
 */
export async function settlePerOption(
  longFlag: boolean,
  owner: string,
  underlierTicker: string,
  unixExpiration: number,
  strikes: number[],
  positionStrategy: PositionStrategy,
  tokenId: number,
  wallet: ethers.Wallet | ethers.providers.JsonRpcSigner,
  networkVersion: Network,
  appVersion: AppVersion
): Promise<string> {
  try {
    const arrowRouter = getRouterContract(networkVersion, appVersion, wallet)
    const bigNumberExpiration = getBigNumberNanoSecFromSec(
      BigNumber.from(unixExpiration.toString())
    )
    const bigNumberPositionStrategy = ethers.BigNumber.from(
      positionStrategy.toString()
    )
    const decimalStrike = getDecimalStrikeString(strikes)

    const marketMaker = await getMarketMakerOfNft(
      tokenId,
      ChainIds[networkVersion],
      appVersion,
      networkVersion
    )

    const settleOptionTransaction = await arrowRouter.settlePerOption(
      owner,
      longFlag,
      underlierTicker,
      bigNumberExpiration,
      decimalStrike,
      bigNumberPositionStrategy,
      marketMaker
    )

    return settleOptionTransaction.hash
  } catch (error) {
    console.log('Error occurred when settling', error)
    throw Error('Unable to settle option')
  }
}

async function getMarketMakerOfNft(
  tokenId: number,
  chainId: number,
  appVersion: AppVersion,
  networkVersion: Network
): Promise<string> {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion]
  const response = await GET<NFTMarketMakerData>(
    apiUrl + '/options/market-maker',
    {
      params: { token_id: tokenId, chain_id: chainId }
    }
  )

  if (response.status === 200) {
    return response.data.market_maker
  } else {
    throw new Error('Failed to retrieve market maker address')
  }
}

export async function getOptionDataFromId(
  tokenId: number,
  quantity: number,
  networkVersion: Network,
  appVersion: AppVersion,
  isShort = false
) {
  try {
    const arrowOptionContract = await getArrowOptionsContract(
      networkVersion,
      appVersion,
      providers[networkVersion]
    )
    const decimals = await (
      await getRFQStablecoinContract(networkVersion, appVersion)
    ).decimals()
    const optionData = await arrowOptionContract.getOptionData(tokenId)
    const unixExpiration = await convertBigNumber(
      optionData.expiration,
      networkVersion,
      appVersion,
      decimals
    )

    const strikes = optionData.decimalStrike
      .split('|')
      .map((strike: string) => Number(strike))
      .filter((strike: number) => strike !== 0)

    const positionType = optionData.contractType.toNumber()

    let contractType = positionType
    if (contractType === PositionStrategy.CALL_SPREAD) {
      contractType = PositionStrategy.CALL
    } else if (contractType === PositionStrategy.PUT_SPREAD) {
      contractType = PositionStrategy.PUT
    }

    const optionLegs = strikes.map((strike: number) => ({
      ticker: optionData.ticker,
      contractType: contractType,
      orderType: getOrderType(
        strikes,
        strike,
        positionType as PositionStrategy,
        isShort
      ),
      strike: strike,
      readableExpiration: getTimeUTC(unixExpiration).readableTimestamp,
      expirationTimestamp: unixExpiration,
      quantity: quantity
    }))

    return optionLegs
  } catch (error) {
    console.log('Failed to fetch option data', error)
  }
}

export async function convertBigNumber(
  input: BigNumber,
  networkVersion: Network,
  appVersion: AppVersion,
  decimals?: number
): Promise<number> {
  if (decimals === null) {
    decimals = await (
      await getRFQStablecoinContract(networkVersion, appVersion)
    ).decimals()
  }
  const output = ethers.utils.formatUnits(input, decimals)

  return parseFloat(output)
}

export function getOrderType(
  strikes: number[],
  strike: number,
  positionType: PositionStrategy,
  isPositionShort: boolean
): OrderType {
  // call debit spread + put credit spread sell higher
  // put debit spread + call credit spread sell lower
  if (strikes.length === 1) {
    return isPositionShort ? OrderType.OPEN_SHORT : OrderType.OPEN_LONG
  }

  if (positionType === PositionStrategy.CALL_SPREAD) {
    if (isPositionShort) {
      if (strike === Math.min(...strikes)) {
        return OrderType.OPEN_SHORT
      } else {
        return OrderType.OPEN_LONG
      }
    } else {
      if (strike === Math.max(...strikes)) {
        return OrderType.OPEN_SHORT
      } else {
        return OrderType.OPEN_LONG
      }
    }
  } else {
    if (isPositionShort) {
      if (strike === Math.max(...strikes)) {
        return OrderType.OPEN_SHORT
      } else {
        return OrderType.OPEN_LONG
      }
    } else {
      if (strike === Math.min(...strikes)) {
        return OrderType.OPEN_SHORT
      } else {
        return OrderType.OPEN_LONG
      }
    }
  }
}

export function waitTransaction(
  txnHash: string,
  networkVersion: Network,
  options: PollingOptions | null = null
): Promise<TransactionReceipt> {
  const provider = providers[networkVersion]
  const DEFAULT_INTERVAL = 500

  const DEFAULT_BLOCKS_TO_WAIT = 0

  const interval =
    options && options.interval ? options.interval : DEFAULT_INTERVAL
  const blocksToWait =
    options && options.blocksToWait
      ? options.blocksToWait
      : DEFAULT_BLOCKS_TO_WAIT
  const transactionReceiptAsync = async function (
    txnHash: string,
    resolve: any,
    reject: any
  ) {
    try {
      const receipt = await provider.getTransactionReceipt(txnHash)

      if (!receipt) {
        setTimeout(function () {
          transactionReceiptAsync(txnHash, resolve, reject)
        }, interval)
      } else {
        if (blocksToWait > 0) {
          const resolvedReceipt = await receipt
          if (!resolvedReceipt || !resolvedReceipt.blockNumber)
            setTimeout(function () {
              transactionReceiptAsync(txnHash, resolve, reject)
            }, interval)
          else {
            try {
              const block = await provider.getBlock(resolvedReceipt.blockNumber)
              const current = await provider.getBlock('latest')
              if (current.number - block.number >= blocksToWait) {
                const txn = await provider.getTransaction(txnHash)
                if (txn.blockNumber !== null) resolve(resolvedReceipt)
                else
                  reject(
                    new Error(
                      'Transaction with hash: ' +
                        txnHash +
                        ' ended up in an uncle block.'
                    )
                  )
              } else
                setTimeout(function () {
                  transactionReceiptAsync(txnHash, resolve, reject)
                }, interval)
            } catch (e) {
              setTimeout(function () {
                transactionReceiptAsync(txnHash, resolve, reject)
              }, interval)
            }
          }
        } else if (isSuccessfulTransaction(receipt)) {
          resolve(receipt)
        } else throw Error('Transaction reverted')
      }
    } catch (e) {
      reject(e)
    }
  }

  return new Promise(function (resolve, reject) {
    transactionReceiptAsync(txnHash, resolve, reject)
  })
}

export function isSuccessfulTransaction(receipt: any): boolean {
  if (receipt.status === '0x1' || receipt.status === 1) {
    return true
  } else {
    return false
  }
}

export function getABIInterface(networkVersion: Network, isContest = false) {
  switch (networkVersion) {
    case Network.Testnet:
      // Fuji Testnet Contest
      if (isContest) return AvalancheFujiContestABIs

      // Fuji Testnet Contest
      return AvalancheFujiTestnetABIs
    case Network.Mainnet:
      // Avalanche C-Chain Mainnet
      return AvalancheMainnetABIs
    default:
      break
  }
}

export async function getArrowTokenContract(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet?: ethers.providers.Provider | ethers.Wallet | ethers.Signer
): Promise<ethers.Contract> {
  // Determine the arrow token contract address based on the network version and app version
  const arrowTokenAddress = ArrowTokenAddresses[appVersion][networkVersion]!
  console.log('arrowTokenAddress', arrowTokenAddress)
  // Create and return an instance of the arrow token contract using the abi
  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  return new ethers.Contract(
    arrowTokenAddress,
    ABIInterface.ArrowToken,
    wallet || providers[networkVersion]
  )
}

export async function getArrowStakingContract(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
): Promise<ethers.Contract> {
  // Determine the arrow stakingcontract address based on the network version and app version
  const arrowStakingAddress = ArrowStakingAddresses[appVersion][networkVersion]!

  // Create and return an instance of the arrow staking contract using the abi
  const ABIInterface = getABIInterface(
    networkVersion,
    appVersion === AppVersion.COMPETITION
  )

  if (!ABIInterface) {
    throw new Error('Failed to retrieve ABI ')
  }

  return new ethers.Contract(
    arrowStakingAddress,
    ABIInterface.ArrowStaking,
    wallet ? wallet : providers[networkVersion]
  )
}
