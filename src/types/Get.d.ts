import type { ShortFormStrategyType } from './general'

interface PositionOption {
  contract_type: number | string
  quantity: number
  strike: number
  side: 'Buy' | 'Sell'
}

interface Transaction {
  ticker: string
  rfe_id?: string
  average_position_price: number | null
  transaction_hash: string | null
  settlement_initialized_at: number | null
  settlement_price: number | null
  is_settled: boolean | null
  token_id: number | null
  position_id: number | null
  options: PositionOption[]
  expiration: number
  execution_price: number | null
  quantity: number
  transaction_type: string
  strategy_type: ShortFormStrategyType
  is_short: boolean
  timestamp: number | null
  transaction_status: string
  failure_message?: string
}

export interface PortfolioData {
  open_positions: Transaction[]
  expired_positions: Transaction[]
  transaction_history: Transaction[]
}

export interface NFTMarketMakerData {
  market_maker: string
}

export interface OrderStatusResponse {
  transaction_status: string
  ticker: string
  position_id: number
  execution_price: number
  transaction_hash: string
}

export interface CurrentStakingAPRResponse {
  apr: number
}

export interface EstimateStakingAPRResponse {
  apr: number
}

export interface APRHistoryResponse {
  timestamps: number[]
  aprs: number[]
}
