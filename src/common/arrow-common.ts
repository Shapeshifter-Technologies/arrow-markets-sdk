import {
  getUnderlierMarketCap,
  getUnderlierMarketChart,
  getUnderlierSpotPrice
} from './utils/pricing'
import { binanceSymbols, coingeckoIDs } from './constants'
import {
  ContractType,
  Currency,
  Interval,
  OrderType,
  PositionStrategy,
  PositionStrategyType,
  Ticker
} from './types/option'
import { ArrowProduct, Chain, Network } from './types/general'
import {
  buildOptionLegs,
  convertToGeneralPositionType,
  determinePositionStrategyType,
  getOrderTypeFromPositionType,
  getReadablePositionType,
  toRegularNumber
} from './utils/parsing'
import { computePriceOfPosition, isExpiredInMoney } from './utils/option'
import {
  getCurrentTimeUTC,
  getExpirationTimestamp,
  getReadableTimestamp,
  getTimeUTC,
  isFriday
} from './utils/time'

/**********************************************
 *           ARROW COMMON INTERFACES          *
 **********************************************/

export interface Option {
  ticker: Ticker
  contractType: ContractType
  orderType: OrderType
  strike: number
  price: number | null
  readableExpiration: string
  expirationTimestamp: number
  quantity: number
  greeks: Greeks | null
}

export interface Position {
  symbol?: string
  ticker: Ticker
  leverage?: number
  optionLegs: Option[]
  strategyType: PositionStrategy
  orderType: OrderType
  ratio: number
  positionId?: number
  price: number | null
  spotPrice?: number
  priceHistory?: {
    date: number
    price: number
  }[]
  greeks: Greeks | null
}

export interface Greeks {
  delta: number // Sensitivity of an option’s price to changes in the value of the underlying.
  gamma: number // Change in delta per change in price of the underlying.
  rho: number // Sensitivity of option prices to changes in interest rates.
  theta: number // Measures time decay of price of option.
  vega: number // Change in value from a 1% change in volatility.
}

export interface ChartData {
  x: number
  y: number
}

const ArrowCommonSDK = {
  // Arrow Enums
  Ticker,
  Currency,
  Interval,
  ContractType,
  PositionStrategy,
  OrderType,
  PositionStrategyType,
  ArrowProduct,
  Network,
  Chain,

  // Arrow Constants
  coingeckoIDs,
  binanceSymbols,

  // API Functions
  getUnderlierMarketChart,
  getUnderlierMarketCap,
  getUnderlierSpotPrice,

  // Parser Functions
  getReadablePositionType,
  toRegularNumber,
  determinePositionStrategyType,
  convertToGeneralPositionType,
  getOrderTypeFromPositionType,
  buildOptionLegs,

  // Option Functions
  isExpiredInMoney,
  computePriceOfPosition,

  // Time Functions
  getCurrentTimeUTC,
  getReadableTimestamp,
  getTimeUTC,
  getExpirationTimestamp,
  isFriday
}

export default ArrowCommonSDK
