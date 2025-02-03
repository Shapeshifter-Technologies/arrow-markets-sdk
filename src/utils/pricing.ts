import { ethers } from 'ethers'
import axios from 'axios'
import type {
  GetBulkOptionPriceResponse,
  GetOptionPricePayload,
  GetOptionPriceResponse,
  GreeksDataRequest,
  GreeksDataResponse,
  OptionLegForAPI
} from '../types/Post'
import type { AppVersion } from '../types/general'
import { ArrowApiUrls } from '../types/api'
import type { Network } from '../common/types/general'
import type { Greeks, Option } from '../common/arrow-common'
import type { Ticker } from '../common/types/option'
import {
  ContractType,
  OrderType,
  PositionStrategy
} from '../common/types/option'
import { getExpirationTimestamp } from '../common/utils/time'
import {
  convertToMarketMakerContractType,
  generateMarketMakerSymbol,
  getSideFromOrderType
} from './parsing'
import { convertTickerDateFormat, readableTimestampToISO8601 } from './time'
import { POST } from './axios'

export async function getRFQOptionPrice(
  optionLegs: Option[],
  expiration: string, // readable
  appVersion: AppVersion,
  networkVersion: Network
): Promise<{ optionPrice: number; greeks: Greeks }> {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion] + '/options/price'

  const orderParameters = {
    options: optionLegs.map(leg => ({
      contract_type: convertToMarketMakerContractType(leg.contractType),
      strike: leg.strike.toString(),
      side: getSideFromOrderType(leg.orderType),
      underlying: optionLegs[0].ticker, // Assuming underlying is the same for all legs
      expiration: readableTimestampToISO8601(expiration)
    }))
  }

  try {
    const response = await axios.post<GetOptionPriceResponse>(
      apiUrl,
      orderParameters
    )

    if (response.data && response.data.price !== undefined) {
      return {
        optionPrice: response.data.price * optionLegs[0].quantity,
        greeks: response.data.greeks
      }
    } else {
      throw new Error('Invalid response from the server')
    }
  } catch (error) {
    throw new Error(`Error fetching option price ${error}`)
  }
}

export async function getBulkRFQOptionPrice(
  optionsToPrice: Option[],
  appVersion: AppVersion,
  networkVersion: Network
): Promise<{
  individualOptionPrices: Record<string, number>
  totalCostOfOptions: number
}> {
  const apiUrl =
    ArrowApiUrls[appVersion][networkVersion] + '/options/bulk-price'

  const resultMapping: { [key: string]: number } = {}
  let totalCostOfOptions = 0

  const optionParametersArray: OptionLegForAPI[] = []
  optionsToPrice.map(async optionLeg => {
    optionParametersArray.push({
      contract_type: convertToMarketMakerContractType(optionLeg.contractType),
      strike: optionLeg.strike.toString(),
      side: getSideFromOrderType(optionLeg.orderType),
      expiration: readableTimestampToISO8601(optionLeg.readableExpiration),
      underlying: optionLeg.ticker
    })
  })

  try {
    const response = await POST<
      GetOptionPricePayload,
      GetBulkOptionPriceResponse
    >(apiUrl, { options: optionParametersArray })

    const { prices } = response.data

    totalCostOfOptions = prices.reduce((total, price) => {
      if (price.side === 'Buy') {
        return total - price.price
      } else if (price.side === 'Sell') {
        return total + price.price
      }

      return totalCostOfOptions
    }, 0)

    if (prices) {
      prices.forEach(priceEntry => {
        resultMapping[priceEntry.ticker] = Math.abs(
          Math.round(priceEntry.price * 100) / 100
        )
      })
    } else {
      throw new Error('Invalid response from the server')
    }
  } catch (error) {
    throw new Error(`Error fetching option price ${error}`)
  }

  return {
    individualOptionPrices: resultMapping,
    totalCostOfOptions: Math.abs(Math.round(totalCostOfOptions * 100) / 100)
  }
}

/**
 * Calculates the threshold price and the amount to approve based on order parameters.
 *
 * @param isBuying - Indicates if the transaction is a buy
 * @param orderQuantity - The quantity of the order.
 * @param optionPrice - The price of the option.
 * @param slippage - The slippage percentage (e.g., 4 for 4%).
 * @param decimals - The number of decimal places.
 * @returns An object containing the prepared threshold price and amount to approve.
 */
export function calculateThresholdPrice(
  isBuying: boolean,
  orderQuantity: number,
  optionPrice: number,
  slippage: number,
  arrowFee: number,
  decimals: number,
  spotPrice: number
): {
  bigNumberThresholdPrice: ethers.BigNumber
  thresholdPrice: number
  preparedAmountToApprove: ethers.BigNumber
} {
  let slippageValue = isBuying ? slippage / 100 + 1 : 1 - slippage / 100

  if (isBuying) {
    slippageValue += arrowFee
  }

  const thresholdPrice = Number(
    (isBuying
      ? Math.ceil(optionPrice * slippageValue * 100) / 100
      : Math.floor(optionPrice * slippageValue * 100) / 100
    ).toFixed(2)
  )

  const preparedThresholdPrice = ethers.utils.parseUnits(
    thresholdPrice.toString(),
    decimals
  )

  const notionalFee = spotPrice * orderQuantity * 0.00075

  const approvalValue = Number(
    (thresholdPrice * orderQuantity + notionalFee).toFixed(2)
  )

  const preparedAmountToApprove = ethers.utils.parseUnits(
    approvalValue.toString(),
    decimals
  )

  return {
    bigNumberThresholdPrice: preparedThresholdPrice,
    thresholdPrice: thresholdPrice,
    preparedAmountToApprove
  }
}

/**
 * Calculates the max order fee based on the given formula.
 * @param thresholdPrice - The threshold price.
 * @param quantity - The quantity.
 * @returns The calculated max order fee.
 */
export function calculateMaxOrderFee(
  thresholdPrice: number,
  quantity: number
): number {
  // Formula: Max order fee = threshold price * quantity * 0.003
  const maxOrderFee = thresholdPrice * quantity * 0.003

  return maxOrderFee
}

export async function getGreeks(
  options: Option[],
  appVersion: AppVersion,
  networkVersion: Network
): Promise<GreeksDataResponse> {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion] + '/options/greeks'

  try {
    const params: GreeksDataRequest = {
      options: options.map(option => ({
        price: option.price!,
        strike: option.strike,
        underlying: option.ticker,
        contract_type: convertToMarketMakerContractType(option.contractType),
        expiration: readableTimestampToISO8601(option.readableExpiration)
      }))
    }

    const response = (
      await POST<GreeksDataRequest, GreeksDataResponse>(apiUrl, params)
    ).data

    return response
  } catch (error) {
    throw new Error(`Error fetching option price ${error}`)
  }
}

export async function getGreeksByTicker(
  tickersInput: Record<string, number>,
  appVersion: AppVersion,
  networkVersion: Network
): Promise<GreeksDataResponse> {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion] + '/options/greeks'

  const tickers = Object.entries(tickersInput).map(([key, value]) => ({
    [key]: value
  }))

  const optionLegs = tickers.map(tickerObj => {
    const [ticker, price] = Object.entries(tickerObj)[0]
    const [tickerSymbol, formattedExpiration, formattedStrikes, strategyType] =
      ticker.split('-')

    const readableExpiration = convertTickerDateFormat(formattedExpiration)
    const expirationTimestamp =
      getExpirationTimestamp(readableExpiration).millisTimestamp

    return {
      ticker: tickerSymbol as Ticker,
      contractType: strategyType === 'C' ? ContractType.CALL : ContractType.PUT,
      orderType: OrderType.OPEN_LONG,
      strike: Number(formattedStrikes),
      readableExpiration: readableExpiration,
      expirationTimestamp: expirationTimestamp,
      price: price
    }
  })

  try {
    const params: GreeksDataRequest = {
      options: optionLegs.map(option => ({
        price: option.price!,
        strike: option.strike,
        underlying: option.ticker,
        contract_type: convertToMarketMakerContractType(option.contractType),
        expiration: readableTimestampToISO8601(option.readableExpiration)
      }))
    }

    const response = (
      await POST<GreeksDataRequest, GreeksDataResponse>(apiUrl, params)
    ).data

    return response
  } catch (error) {
    throw new Error(`Error fetching option price ${error}`)
  }
}

export async function getGreeksByOptions(
  optionLegs: Option[],
  appVersion: AppVersion,
  networkVersion: Network
): Promise<GreeksDataResponse & { aggregateGreeks: Greeks }> {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion] + '/options/greeks'

  try {
    const params: GreeksDataRequest = {
      options: optionLegs.map(option => ({
        price: option.price!,
        strike: option.strike,
        underlying: option.ticker,
        contract_type: convertToMarketMakerContractType(option.contractType),
        expiration: readableTimestampToISO8601(option.readableExpiration)
      }))
    }

    const response = (
      await POST<GreeksDataRequest, GreeksDataResponse>(apiUrl, params)
    ).data

    // Initialize aggregate values
    const aggregate: Greeks = {
      delta: 0,
      theta: 0,
      gamma: 0,
      vega: 0,
      rho: 0
    }

    // Aggregate the values considering the order type
    optionLegs.forEach(option => {
      const greeks = response[generateMarketMakerSymbol([option])]
      if (greeks) {
        const multiplier =
          option.orderType === OrderType.OPEN_LONG ||
          option.orderType === OrderType.CLOSE_SHORT
            ? 1
            : -1
        aggregate.delta += greeks.delta * multiplier
        aggregate.theta += greeks.theta * multiplier
        aggregate.gamma += greeks.gamma * multiplier
        aggregate.vega += greeks.vega * multiplier
        aggregate.rho += greeks.rho * multiplier
      }
    })

    // Return the response with aggregate values
    return { ...response, aggregateGreeks: aggregate }
  } catch (error) {
    throw new Error(`Error fetching option price ${error}`)
  }
}

export function getSingleAtomPayoff(
  contractType: PositionStrategy,
  strike: number[],
  settlementPrice: number,
  purchasePrice: number,
  orderQuantity: number
): number {
  let singleAtomPayoff = 0
  // Calculate the intrinsic value per contract based on the strategy type
  if (contractType === PositionStrategy.PUT) {
    if (settlementPrice < strike[0]) {
      singleAtomPayoff = strike[0] - settlementPrice
    } else {
      singleAtomPayoff = 0
    }
  } else if (contractType === PositionStrategy.CALL) {
    if (settlementPrice > strike[0]) {
      singleAtomPayoff = settlementPrice - strike[0]
    } else {
      singleAtomPayoff = 0
    }
  } else if (contractType === PositionStrategy.PUT_SPREAD) {
    if (settlementPrice < strike[0]) {
      if (settlementPrice > strike[1]) {
        singleAtomPayoff = strike[0] - settlementPrice
      } else {
        singleAtomPayoff = strike[0] - strike[1]
      }
    } else {
      singleAtomPayoff = 0
    }
  } else if (contractType === PositionStrategy.CALL_SPREAD) {
    if (settlementPrice > strike[0]) {
      if (settlementPrice < strike[1]) {
        singleAtomPayoff = settlementPrice - strike[0]
      } else {
        singleAtomPayoff = strike[1] - strike[0]
      }
    } else {
      singleAtomPayoff = 0
    }
  }

  // Multiply by the order quantity to get the total intrinsic value
  const totalIntrinsicPayoff = singleAtomPayoff * orderQuantity

  // Subtract the total cost of purchase from the intrinsic payoff
  return totalIntrinsicPayoff
}
