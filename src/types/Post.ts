import type { Option, Greeks } from '../common/arrow-common'
import type { OrderType, Ticker } from '../common/types/option'

import type { OptionEntry, Strategy } from './option'

export interface OptionLegForAPI {
  contract_type: 'C' | 'P' | 'CS' | 'PS'
  side: 'Buy' | 'Sell'
  strike: string
  expiration: string // ISO 8601 date string
  underlying: string
}
export interface GetOptionPricePayload {
  options: OptionLegForAPI[]
}

export interface GetOptionPriceResponse {
  price: number // Option price
  greeks: Greeks
}

export interface BulkPriceEntry {
  ticker: string
  strike: number
  expiration: string
  side: 'Buy' | 'Sell'
  price: number
}
export interface GetBulkOptionPriceResponse {
  prices: BulkPriceEntry[]
}

export interface APIOptionOrderEntry {
  chain_id: number
  option: OptionEntry[]
  underlying: string
  order_type: number
  position_id?: number
  quantity: string
  sender_address: string
  signature: string
  transaction_deadline: number
  signature_timestamp: number
  threshold_price: string
  device?: string
  mode?: string
}

export interface APIOptionOrderParams {
  option_orders_list: APIOptionOrderEntry[]
  use_trading_credits?: boolean
}

export interface OptionOrder {
  options: Option[]
  orderType: OrderType
  quantity: number
  positionId?: number
  senderAddress: string
  signature: string
  signatureTimestamp: number
  transactionDeadline: number
  threshold_price: number
}

export interface APIOptionOrderResponse {
  order_id: string
}

interface RecommendedOption {
  expiration: string
  option_legs: RecommendedOptionLeg[]
  underlying: Ticker
}

export interface GetRecommendedOptionsParams {
  ticker: string
  strategy_type: Strategy
  expiration: string
  forecast: number
  spot_price: number
  price_history: number[] | null
}

export interface RecommendedOptionLeg {
  contract_type: 'C' | 'P'
  price: number
  side: 'Buy' | 'Sell'
  strike: number
  greeks: Greeks
}

interface RecommendedOption {
  expiration: string
  option_legs: RecommendedOptionLeg[]
  leverage: number
  underlying: Ticker
  greeks: Greeks
}

export interface GetRecommendedOptionsResponse {
  options: RecommendedOption[]
}

export interface StrikeGridOption {
  strike: string
  bid: number | null
  ask: number | null
  side: string
  ticker: string
  open_interest: number
  greeks: Greeks
}

export interface GetStrikeGridResponse {
  option_grid: StrikeGridOption[]
}

export interface GreekRequestOption {
  strike: number
  underlying: Ticker
  contract_type: 'C' | 'P'
  price: number
  expiration: string // In ISO 8601 format
}

export interface GreeksDataRequest {
  options: GreekRequestOption[]
}

export interface GreeksDataItem {
  [key: string]: {
    delta: number
    theta: number
    gamma: number
    vega: number
    rho: number
  }
}

export type GreeksDataResponse = GreeksDataItem
