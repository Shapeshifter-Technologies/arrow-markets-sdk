import type { OptionContract } from './types/option'
import { readableTimestampToISO8601 } from './utils/time'
import type { AppVersion } from './types/general'
import { ArrowApiUrls } from './types/api'
import { POST } from './utils/axios'
import type { GetStrikeGridResponse } from './types/Post'
import { Network } from './common/types/general'
import type { Ticker } from './common/types/option'
import { ContractType } from './common/types/option'
import {
  getUnderlierSpotPrice,
  getUnderlierMarketChart
} from './common/utils/pricing'
import { getExpirationTimestamp } from './common/utils/time'

/**
 * Get a strike grid given some option parameters.
 *
 * @param orderType Type of order the user is placing. 0 for long open, 1 for long close, 2 for short open, 3 for short close.
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param contractType // 0 for call, 1 for put.
 * @param spotPrice // Most up-to-date price of underlying asset.
 * @param priceHistory // Prices of underlying asset over some period of history.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Array of Option objects with optional price and greeks parameters populated.
 */
export async function getStrikeGrid(
  ticker: Ticker,
  readableExpiration: string,
  contractType: ContractType.CALL | ContractType.PUT,
  appVersion: AppVersion,
  networkVersion = Network.Testnet,
  spotPrice: number | undefined = undefined,
  priceHistory: number[] | undefined = undefined
): Promise<{
  sellStrikeGrid: OptionContract[]
  buyStrikeGrid: OptionContract[]
}> {
  if (spotPrice === undefined) {
    spotPrice = await getUnderlierSpotPrice(ticker)
  }
  if (priceHistory === undefined) {
    priceHistory = (await getUnderlierMarketChart(ticker)).priceHistory.map(
      entry => entry.price
    )
  }

  let parsedContractType = 'C'
  if (contractType === ContractType.PUT) {
    parsedContractType = 'P'
  }

  const apiUrl = ArrowApiUrls[appVersion][networkVersion]
  const orderParameters = {
    underlying: ticker,
    expiration: readableTimestampToISO8601(readableExpiration),
    contract_type: parsedContractType,
    price_history: priceHistory,
    spot_price: spotPrice
  }

  const apiResponse = await POST<any, GetStrikeGridResponse>(
    `${apiUrl}/options/grid`,
    orderParameters
  )

  const { data: strikeGridResponse } = apiResponse
  const buyStrikeGrid: OptionContract[] = []
  const sellStrikeGrid: OptionContract[] = []

  strikeGridResponse.option_grid.forEach(strikeGridOption => {
    buyStrikeGrid.push({
      ticker: ticker,
      expiration: getExpirationTimestamp(readableExpiration).millisTimestamp,
      strike: Number(strikeGridOption.strike),
      contractType: contractType,
      price: strikeGridOption.ask!,
      openInterest: strikeGridOption.open_interest,
      greeks: strikeGridOption.greeks,
      leverage: calculateLeverage(
        strikeGridOption.greeks.delta,
        spotPrice!,
        strikeGridOption.ask!
      )
    })
    sellStrikeGrid.push({
      ticker: ticker,
      expiration: getExpirationTimestamp(readableExpiration).millisTimestamp,
      strike: Number(strikeGridOption.strike),
      contractType: contractType,
      price: strikeGridOption.bid!,
      openInterest: strikeGridOption.open_interest,
      greeks: strikeGridOption.greeks,
      leverage: calculateLeverage(
        strikeGridOption.greeks.delta,
        spotPrice!,
        strikeGridOption.bid!
      )
    })
  })

  return { sellStrikeGrid, buyStrikeGrid }
}

export function calculateLeverage(
  delta: number,
  spotPrice: number,
  premium: number
): number {
  return (delta * spotPrice) / premium
}
