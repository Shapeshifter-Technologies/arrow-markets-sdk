import type { Strategy } from '../types/option'
import type {
  GetRecommendedOptionsParams,
  GetRecommendedOptionsResponse
} from '../types/Post'
import type { AppVersion } from '../types/general'
import { ArrowApiUrls } from '../types/api'
import type { Position } from '../common/arrow-common'
import { Network } from '../common/types/general'
import type { Ticker } from '../common/types/option'
import {
  ContractType,
  OrderType,
  PositionStrategyType
} from '../common/types/option'
import {
  determinePositionStrategyType,
  convertToGeneralPositionType
} from '../common/utils/parsing'
import { getUnderlierSpotPrice } from '../common/utils/pricing'
import { getExpirationTimestamp } from '../common/utils/time'
import { readableTimestampToISO8601 } from './time'
import { POST } from './axios'

export async function getRecommendedOptions(
  ticker: Ticker,
  Strategy: Strategy,
  expiration: string, // Readable expiration (09012024)
  forecastPrice: number,
  spotPrice: number | null,
  priceHistory: number[],
  appVersion: AppVersion,
  networkVersion = Network.Testnet
) {
  try {
    if (spotPrice == null) {
      spotPrice = await getUnderlierSpotPrice(ticker)
    }
    const iso8601Expiration = readableTimestampToISO8601(expiration)

    // Build requestParameters
    const requestParameters = {
      ticker,
      strategy_type: Strategy,
      expiration: iso8601Expiration,
      forecast: forecastPrice,
      spot_price: spotPrice,
      price_history: priceHistory
    }

    const apiUrl = ArrowApiUrls[appVersion][networkVersion]
    const res = await POST<
      GetRecommendedOptionsParams,
      GetRecommendedOptionsResponse
    >(apiUrl + '/options/get-recommendations', requestParameters)

    const options = res.data.options.map(option => {
      const optionLegs = option.option_legs.map(leg => {
        const parsedLeg = {
          ticker: option.underlying,
          contractType:
            leg.contract_type === 'C' ? ContractType.CALL : ContractType.PUT,
          orderType:
            leg.side === 'Buy' ? OrderType.OPEN_LONG : OrderType.OPEN_SHORT,
          strike: leg.strike,
          price: leg.price,
          readableExpiration: expiration,
          expirationTimestamp:
            getExpirationTimestamp(expiration).millisTimestamp,
          quantity: 1,
          greeks: leg.greeks
        }

        return parsedLeg
      })
      const positionType = determinePositionStrategyType(optionLegs)
      const strategyType = convertToGeneralPositionType(positionType)
      const position: Position = {
        ticker: option.underlying,
        optionLegs: optionLegs,
        leverage: option.leverage,
        strategyType: strategyType,
        orderType: [
          PositionStrategyType.CALL_CREDIT_SPREAD,
          PositionStrategyType.PUT_CREDIT_SPREAD,
          PositionStrategyType.SHORT_CALL,
          PositionStrategyType.SHORT_PUT
        ].includes(positionType)
          ? OrderType.OPEN_SHORT
          : OrderType.OPEN_LONG,
        ratio: 1,
        greeks: option.greeks,
        price: null
      }

      return position
    })

    return options
  } catch (error) {
    console.log(error)
    throw new Error('Unable to fetch recommended options')
  }
}
