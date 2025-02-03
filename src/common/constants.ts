import { Ticker } from './types/option'
import { ArrowProduct, Network } from './types/general'
/******************************
 *       Pricing Constants    *
 ******************************/
export const coingeckoIDs: Record<string, string> = {
  [Ticker.AVAX]: 'avalanche-2',
  [Ticker.ETH]: 'ethereum',
  [Ticker.BTC]: 'bitcoin'
}

export const binanceSymbols: Record<string, string> = {
  [Ticker.AVAX]: 'AVAXUSDT',
  [Ticker.ETH]: 'ETHUSDT',
  [Ticker.BTC]: 'BTCUSDT'
}

export const BINANCE_API_URL = 'https://data-api.binance.vision/api/v3'

/***************************
 *       Time Constants    *
 ***************************/
export const secondsPerDay = 60 * 60 * 24

/********************************
 *       Arrow API Constants    *
 ********************************/
export const BaseArrowAPI: Record<ArrowProduct, Record<Network, string>> = {
  [ArrowProduct.AMM]: {
    [Network.Testnet]: 'https://api-amm-testnet.prd.arrowmarkets.info/v1/',
    // TODO change to mainnet when ready
    [Network.Mainnet]: 'https://api-amm-testnet.prd.arrowmarkets.info/v1/'
  },
  [ArrowProduct.VAULT]: {
    [Network.Testnet]: 'https://api-vault-testnet.prd.arrowmarkets.info/',
    [Network.Mainnet]: 'https://api-vault-mainnet.prd.arrowmarkets.info/'
  }
}

export enum Interval {
  SECONDLY = '1s',
  MINUTELY = '1m',
  THREE_MINUTELY = '3m',
  FIVE_MINUTELY = '5m',
  FIFTEEN_MINUTELY = '15m',
  THIRTY_MINUTELY = '30m',
  HOURLY = '1h',
  TWO_HOURLY = '2h',
  FOUR_HOURLY = '4h',
  SIX_HOURLY = '6h',
  EIGHT_HOURLY = '8h',
  TWELVE_HOURLY = '12h',
  DAILY = '1d',
  THREE_DAILY = '3d',
  WEEKLY = '1w',
  MONTHLY = '1M'
}
