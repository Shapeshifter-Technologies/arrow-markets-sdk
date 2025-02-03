import { Greeks, Option } from '../arrow-common'
import { ContractType, Currency, Interval, OrderType, Ticker } from './option'

export type GetBinanceTickerPriceResponse = {
  price: number
  code: number
}

export interface BinanceHistoricalPricesResponse {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
  quoteAssetVolume: number
  numberOfTrades: number
  takerBuyBaseAssetVolume: number
  takerBuyQuoteAssetVolume: number
  ignore: number
}

export interface GetUnderlierHistoricalPricesRequest {
  vs_currency: Currency
  days?: number
  from?: number
  to?: number
  interval?: Interval
}

export interface GetUnderlierHistoricalPricesResponse {
  market_caps: number[][]
  prices: number[][]
  total_volumes: number[][]
}

/*************************************
 *           Arrow Pricing Types     *
 *************************************/
export interface ArrowOptionPricePayload {
  options: {
    contract_type: ContractType
    order_type: OrderType
    expiration: string
    quantity: number
    strike: number
    ticker: Ticker
  }[]
  spot_price?: number
  price_history?: number[]
}

export interface ArrowOptionPriceResponse {
  option_legs_prices: {
    strike: number
    contractType: ContractType
    orderType: OrderType
    price: number
  }[]
  total_position_price: number
  greeks: Greeks
}

export interface BinancePriceHistoryOutput {
  openTime: number // Kline open time
  openPrice: string // Open price
  highPrice: string // High price
  lowPrice: string // Low price
  closePrice: string // Close price
  volume: string // Volume
  closeTime: number // Kline Close time
  quoteAssetVolume: string // Quote asset volume
  numberOfTrades: number // Number of trades
  takerBuyBaseAssetVolume: string // Taker buy base asset volume
  takerBuyQuoteAssetVolume: string // Taker buy quote asset volume
}
