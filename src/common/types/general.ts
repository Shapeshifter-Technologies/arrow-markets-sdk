export enum ArrowProduct {
  AMM = 'amm',
  VAULT = 'vault'
}

export enum Network {
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}

export enum Chain {
  Avalanche = 'avalanche',
  Berachain = 'berachain',
  Arbitrum = 'arbitrum'
}

export enum BinanceInterval {
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

export interface PriceHistory {
  date: number
  price: number
}
