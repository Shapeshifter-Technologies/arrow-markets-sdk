import {
  BINANCE_API_URL,
  BaseArrowAPI,
  binanceSymbols,
  coingeckoIDs
} from '../constants'
import type { Ticker } from '../types/option'
import { Currency } from '../types/option'
import type {
  ArrowOptionPricePayload,
  ArrowOptionPriceResponse,
  BinancePriceHistoryOutput,
  GetBinanceTickerPriceResponse,
  GetUnderlierHistoricalPricesResponse
} from '../types/api'
import type { Option } from '../arrow-common'
import type { PriceHistory, Network } from '../types/general'
import { ArrowProduct, BinanceInterval } from '../types/general'
import { GET, POST } from './axios'

/*****************************************
 *           Arrow Pricing Functions     *
 *****************************************/

/**
 * Estimates the price of an option or spread option contract.
 *
 * @param isSpread - A boolean indicating whether the contract is a spread option contract.
 * @param contract - An object containing the parameters of the contract to price. If `isSpread` is true, this should be a `SpreadOptionContractParams` object. If `isSpread` is false, this should be an `OptionContractParams` object.
 * @param orderType - The type of order to use for pricing. This should be an integer value.
 * @param spotPrice - The spot price to use for pricing. This should be a number value.
 * @param priceHistory - An array of price history data to use for pricing. This should be an array of number values.
 * @param version - An optional parameter indicating the deployment version of the Arrow API to use. This should be a value from the `DeploymentVersion` enum. The default value is `DeploymentVersion.FUJI`.
 *
 * @returns A promise that resolves to the estimated price and greeks of the contract, or null if there was an error.
 *
 * @throws An error if the input parameters are invalid.
 */
export async function estimateOptionPrice(
  options: Option[],
  network: Network,
  product: ArrowProduct
): Promise<ArrowOptionPriceResponse> {
  const spotPrice = await getUnderlierSpotPrice(options[0].ticker)
  const { priceHistory } = await getUnderlierMarketChart(options[0].ticker)
  const optionPayload = options.map(option => ({
    contract_type: option.contractType,
    order_type: option.orderType,
    expiration: option.readableExpiration,
    quantity: option.quantity,
    strike: option.strike,
    ticker: option.ticker
  }))

  const payload: ArrowOptionPricePayload = {
    options: optionPayload,
    spot_price: spotPrice,
    price_history: priceHistory.map(entry => entry.price)
  }

  try {
    let arrowApiUrl = BaseArrowAPI[product][network]
    if (product === ArrowProduct.VAULT) {
      arrowApiUrl = arrowApiUrl + 'option/estimate-price'
    } else {
      arrowApiUrl = arrowApiUrl + 'estimate-option-price'
    }

    const response = await POST<
      ArrowOptionPricePayload,
      ArrowOptionPriceResponse
    >(arrowApiUrl, payload)

    return {
      total_position_price: response.data['total_position_price'],
      greeks: response.data['greeks'],
      option_legs_prices: response.data['option_legs_prices']
    }
  } catch (error) {
    console.error(error)

    throw Error('Error estimating option price.')
  }
}

/********************************************
 *           External Pricing Functions     *
 ********************************************/

export async function getUnderlierSpotPrice(ticker: Ticker) {
  try {
    const binanceResponse = await GET<GetBinanceTickerPriceResponse>(
      `https://data-api.binance.vision/api/v3/ticker/price`,
      {
        params: {
          symbol: binanceSymbols[ticker]
        }
      }
    )

    try {
      return parseFloat(binanceResponse.data.price.toString())
    } catch {
      throw Error('Could not retrieve underlying spot price from Binance.')
    }
  } catch (binanceUSError) {
    // If both Binance and Binance US requests fail, use CryptoWatch
    const cryptowatchResponse = await GET<any>(
      `https://api.cryptowat.ch/markets/binance/${binanceSymbols[ticker]}/price`
    )

    try {
      return parseFloat(cryptowatchResponse.data.result.price)
    } catch {
      throw Error('Could not retrieve underlying spot price from CryptoWatch.')
    }
  }
}

/**
 * Get the price history and market caps for the underlying asset using CoinGecko.
 *
 * @param ticker Ticker of underlying asset.
 * @param days Number of days worth of historical data to get from CoinGecko. Default is 84 days to match the API.
 * @param currency Currency to which we wish to convert the value. Default is USD to match the API.
 * @returns Price history and market caps of the underlying asset as 2D arrays of dates and values (floats).
 */
export async function getUnderlierMarketCap(
  ticker: Ticker,
  days = 84,
  currency = Currency.USD
) {
  const underlierID = coingeckoIDs[ticker]

  const {
    data: { market_caps: marketCaps }
  } = await GET<GetUnderlierHistoricalPricesResponse>(
    `https://api.coingecko.com/api/v3/coins/${underlierID}/market_chart`,
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      params: {
        days,
        vs_currency: currency
      }
    }
  )

  return { marketCap: marketCaps[marketCaps.length - 1][1] }
}

/**
 * Get the price history and market caps for the underlying asset using CoinGecko.
 *
 * @param ticker Ticker of underlying asset.
 * @param days Number of days worth of historical data to get from CoinGecko. Default is 84 days to match the API.
 * @param currency Currency to which we wish to convert the value. Default is USD to match the API.
 * @returns Price history and market caps of the underlying asset as 2D arrays of dates and values (floats).
 */
export async function getUnderlierPriceHistory(
  ticker: Ticker,
  daysAgo: number
) {
  try {
    const { startTime, endTime, interval } =
      computePriceHistoryRequestPrams(daysAgo)
    const inputParams = {
      symbol: binanceSymbols[ticker],
      interval,
      startTime,
      endTime,
      limit: 1000
    }

    const response = await GET<any[]>(`${BINANCE_API_URL}/klines`, {
      params: inputParams
    })

    return parseKlineData(
      response.data.map(klineEntry =>
        mapToBinancePriceHistoryOutput(klineEntry)
      )
    )
  } catch (binanceUSError) {
    console.log(
      'Could not retrieve underlying spot price from Binance.',
      binanceUSError
    )
    throw Error('Could not retrieve underlying spot price from Binance.')
  }
}

function parseKlineData(
  klineData: BinancePriceHistoryOutput[]
): PriceHistory[] {
  return klineData.map(data => ({
    date: data.openTime,
    price: parseFloat(data.closePrice)
  }))
}

export function computePriceHistoryRequestPrams(daysAgo: number): {
  startTime: number
  endTime: number
  interval: BinanceInterval
  cacheDuration: number
} {
  const now = new Date()
  const endTime = now.getTime()

  let startTime: number
  let interval: BinanceInterval
  let cacheDuration: number

  if (daysAgo === 1) {
    startTime = new Date(endTime - 24 * 60 * 60 * 1000).getTime()
    interval = BinanceInterval.FIVE_MINUTELY
    cacheDuration = 30
  } else if (daysAgo >= 2 && daysAgo <= 90) {
    startTime = new Date(endTime - daysAgo * 24 * 60 * 60 * 1000).getTime()
    interval = BinanceInterval.HOURLY
    cacheDuration = 30 * 60
  } else if (daysAgo > 90) {
    startTime = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ).getTime()
    interval = BinanceInterval.DAILY
    cacheDuration = 12 * 60 * 60
  } else {
    throw new Error('Invalid number of days ago')
  }

  return { startTime, endTime, interval, cacheDuration }
}

function mapToBinancePriceHistoryOutput(
  klineData: any[]
): BinancePriceHistoryOutput {
  return {
    openTime: klineData[0],
    openPrice: klineData[1],
    highPrice: klineData[2],
    lowPrice: klineData[3],
    closePrice: klineData[4],
    volume: klineData[5],
    closeTime: klineData[6],
    quoteAssetVolume: klineData[7],
    numberOfTrades: klineData[8],
    takerBuyBaseAssetVolume: klineData[9],
    takerBuyQuoteAssetVolume: klineData[10]
  }
}

/**
 * TO DEPRECATE
 * Get the price history and market caps for the underlying asset using CoinGecko.
 *
 * @param ticker Ticker of underlying asset.
 * @param days Number of days worth of historical data to get from CoinGecko. Default is 84 days to match the API.
 * @param currency Currency to which we wish to convert the value. Default is USD to match the API.
 * @returns Price history and market caps of the underlying asset as 2D arrays of dates and values (floats).
 */
export async function getUnderlierMarketChart(
  ticker: Ticker,
  days = 84,
  currency = Currency.USD
) {
  const underlierID = coingeckoIDs[ticker]

  const {
    data: { market_caps: marketCaps, prices }
  } = await GET<GetUnderlierHistoricalPricesResponse>(
    `https://api.coingecko.com/api/v3/coins/${underlierID}/market_chart`,
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      params: {
        days,
        vs_currency: currency
      }
    }
  )

  const priceHistory = prices.map(entry => ({
    date: entry[0],
    price: entry[1]
  }))

  return { priceHistory, marketCaps }
}
