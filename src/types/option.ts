import type { BigNumber } from 'ethers'
import type { Greeks, Option } from '../common/arrow-common'
import type {
  Ticker,
  PositionStrategy,
  ContractType
} from '../common/types/option'

export interface SmartContractOptionOrderParams {
  ticker: Ticker
  longFlag: boolean
  expiration: BigNumber
  arrayOfStrikes: BigNumber[]
  strikesString: string
  positionStrategy: PositionStrategy
  orderQuantity: BigNumber
  thresholdPrice: BigNumber
  signatureTimestamp: BigNumber
}

export interface OptionEntry {
  contract_type: 'C' | 'P'
  expiration: string
  strike: string
}

export interface MarketMakerOrderParams {
  ticker: string
  expiration: string
  strikes: [number, number]
  contract_type: PositionStrategy
  quantity: number
  option_price: number
  market_maker_signature_timestamp: number
  market_maker_deadline_timestamp: number
}

export interface OptionContract {
  ticker: Ticker // Ticker enum that denotes a particular asset.
  expiration: number // Expiration in milliseconds
  strike: number
  contractType: ContractType // ContractType enum that indicates whether the option is a call, put, call spread, or put spread.
  price?: number // Float number that indicates the price of 1 option.
  spotPrice?: number // Most up-to-date price of underlying asset.
  priceHistory?: {
    date: number
    price: number
  }[] // Prices of underlying asset over some period of history.
  greeks?: Greeks // Greeks interface that specifies which greeks are tied to this option.
  openInterest?: number
  leverage?: number
}

export enum Strategy {
  BULLISH_TARGET = 'BULLISH_TARGET',
  BEARISH_TARGET = 'BEARISH_TARGET',
  BREAKDOWN = 'BREAKDOWN',
  BREAKOUT = 'BREAKOUT',
  SUPPORT = 'SUPPORT',
  RESISTANCE = 'RESISTANCE'
}

export interface UserPosition {
  options: Option[]
  positionId?: number
}
