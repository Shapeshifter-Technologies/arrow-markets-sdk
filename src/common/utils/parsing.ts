import type { BigNumber } from 'ethers'
import type { Ticker } from '../types/option'
import {
  ContractType,
  OrderType,
  PositionStrategy,
  PositionStrategyType
} from '../types/option'

import type { Option } from '../arrow-common'
import { UNSUPPORTED_POSITION_ERROR } from '../types/exceptions'
import { getTimeUTC } from './time'

/**
 * Converts a BigNumber or an array of BigNumbers to regular numbers, scaled down by the specified factor.
 *
 * @param {BigNumber | BigNumber[]} input - The BigNumber or array of BigNumbers to be converted.
 * @param {number} [scale=0] - The scaling factor (default is 6, which divides input by 10^6).
 * @returns {number | number[]} The converted regular number or an array of converted regular numbers.
 */
export function toRegularNumber(
  input: BigNumber | BigNumber[],
  scale = 0
): any {
  const scaleDown = (bigNumber: BigNumber) => bigNumber.div(scale).toNumber()

  if (Array.isArray(input)) {
    return input.map(scaleDown)
  } else {
    return scaleDown(input)
  }
}

/**
 * Get the readable position strategy type based on the position type and order type.
 * @param positionType The position strategy.
 * @param orderType The order type.
 * @returns The corresponding readable position strategy type.
 * @throws {Error} if the position type is unsupported.
 */
export function getReadablePositionType(
  positionType: PositionStrategy,
  orderType: OrderType
): PositionStrategyType {
  switch (positionType) {
    case PositionStrategy.CALL:
      return orderType === OrderType.CLOSE_LONG ||
        orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_CALL
        : PositionStrategyType.SHORT_CALL

    case PositionStrategy.PUT:
      return orderType === OrderType.CLOSE_LONG ||
        orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_PUT
        : PositionStrategyType.SHORT_PUT

    case PositionStrategy.CALL_SPREAD:
      return orderType === OrderType.OPEN_LONG ||
        orderType === OrderType.CLOSE_LONG
        ? PositionStrategyType.CALL_DEBIT_SPREAD
        : PositionStrategyType.CALL_CREDIT_SPREAD

    case PositionStrategy.PUT_SPREAD:
      return orderType === OrderType.CLOSE_LONG ||
        orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.PUT_DEBIT_SPREAD
        : PositionStrategyType.PUT_CREDIT_SPREAD

    case PositionStrategy.IRON_CONDOR:
      return orderType === OrderType.CLOSE_LONG ||
        orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_IRON_CONDOR
        : PositionStrategyType.SHORT_IRON_CONDOR

    case PositionStrategy.BUTTERFLY:
      return orderType === OrderType.CLOSE_LONG ||
        orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_BUTTERFLY
        : PositionStrategyType.SHORT_BUTTERFLY

    case PositionStrategy.STRADDLE:
      return orderType === OrderType.CLOSE_LONG ||
        orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_STRADDLE
        : PositionStrategyType.SHORT_STRADDLE

    case PositionStrategy.STRANGLE:
      return orderType === OrderType.CLOSE_LONG ||
        orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_STRANGLE
        : PositionStrategyType.SHORT_STRANGLE

    default:
      return PositionStrategyType.CUSTOM
  }
}

export function determinePositionStrategyType(
  options: Option[]
): PositionStrategyType {
  if (options.length === 1) {
    const [option] = options
    if (option.contractType === ContractType.CALL) {
      return option.orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_CALL
        : PositionStrategyType.SHORT_CALL
    } else if (option.contractType === ContractType.PUT) {
      return option.orderType === OrderType.OPEN_LONG
        ? PositionStrategyType.LONG_PUT
        : PositionStrategyType.SHORT_PUT
    }
  }

  const calls = options
    .filter(o => o.contractType === ContractType.CALL)
    .sort((a, b) => a.strike - b.strike)

  const puts = options
    .filter(o => o.contractType === ContractType.PUT)
    .sort((a, b) => a.strike - b.strike)

  const longOptions = options
    .filter(o => o.orderType === OrderType.OPEN_LONG)
    .sort((a, b) => a.strike - b.strike)

  const shortOptions = options
    .filter(o => o.orderType === OrderType.OPEN_SHORT)
    .sort((a, b) => a.strike - b.strike)

  if (options.length === 2) {
    const [option1, option2] = options

    const positionHasSameContractType = calls.length === 0 || puts.length === 0

    if (positionHasSameContractType) {
      const positionHasSameOrderType = option1.orderType === option2.orderType

      if (positionHasSameOrderType) {
        return PositionStrategyType.CUSTOM
      }

      const hasAllCallOptions = option1.contractType === ContractType.CALL

      if (hasAllCallOptions) {
        longOptions
        if (option1.strike < option2.strike) {
          return option1.orderType === OrderType.OPEN_LONG &&
            option2.orderType === OrderType.OPEN_SHORT
            ? PositionStrategyType.CALL_DEBIT_SPREAD
            : PositionStrategyType.CALL_CREDIT_SPREAD
        } else if (option1.strike === option2.strike) {
          return PositionStrategyType.CUSTOM
        } else {
          return option1.orderType === OrderType.OPEN_LONG &&
            option2.orderType === OrderType.OPEN_SHORT
            ? PositionStrategyType.CALL_CREDIT_SPREAD
            : PositionStrategyType.CALL_DEBIT_SPREAD
        }
      } else if (option1.contractType === ContractType.PUT) {
        if (option1.strike < option2.strike) {
          return option1.orderType === OrderType.OPEN_LONG &&
            option2.orderType === OrderType.OPEN_SHORT
            ? PositionStrategyType.PUT_CREDIT_SPREAD
            : PositionStrategyType.PUT_DEBIT_SPREAD
        } else {
          return option1.orderType === OrderType.OPEN_LONG &&
            option2.orderType === OrderType.OPEN_SHORT
            ? PositionStrategyType.PUT_DEBIT_SPREAD
            : PositionStrategyType.PUT_CREDIT_SPREAD
        }
      }
    } else if (
      (option1.contractType === ContractType.CALL &&
        option2.contractType === ContractType.PUT) ||
      (option1.contractType === ContractType.PUT &&
        option2.contractType === ContractType.CALL)
    ) {
      if (option1.strike === option2.strike) {
        return option1.orderType === OrderType.OPEN_LONG
          ? PositionStrategyType.LONG_STRADDLE
          : PositionStrategyType.SHORT_STRADDLE
      } else {
        return option1.orderType === OrderType.OPEN_LONG
          ? PositionStrategyType.LONG_STRANGLE
          : PositionStrategyType.SHORT_STRANGLE
      }
    }
  } else if (options.length === 4) {
    const callOptions = calls.sort((a, b) => a.strike - b.strike)
    const putOptions = puts.sort((a, b) => a.strike - b.strike)

    if (callOptions.length === 2 && putOptions.length === 2) {
      const [lowPut, highPut] = putOptions
      const [lowCall, highCall] = callOptions

      const isLongIronCondor =
        lowPut.orderType === OrderType.OPEN_SHORT && // Sell 95 Put
        highPut.orderType === OrderType.OPEN_LONG && // Buy 100 Put
        lowCall.orderType === OrderType.OPEN_LONG && // Buy 105 Call
        highCall.orderType === OrderType.OPEN_SHORT // Sell 110 Call

      const isShortIronCondor =
        lowPut.orderType === OrderType.OPEN_LONG && // Buy 95 Put
        highPut.orderType === OrderType.OPEN_SHORT && // Sell 100 Put
        lowCall.orderType === OrderType.OPEN_SHORT && // Sell 105 Call
        highCall.orderType === OrderType.OPEN_LONG // Buy 110 Call

      if (isLongIronCondor || isShortIronCondor) {
        if (
          lowPut.strike < highPut.strike &&
          lowCall.strike < highCall.strike &&
          highPut.strike < lowCall.strike
        ) {
          return isLongIronCondor
            ? PositionStrategyType.LONG_IRON_CONDOR
            : PositionStrategyType.SHORT_IRON_CONDOR
        }
      }

      // Iron Butterfly detection
      const strikes = options.map(o => o.strike)
      const middleStrike = strikes[1]
      const outerStrikes = [strikes[0], strikes[3]].sort((a, b) => a - b)

      const isIronButterfly =
        putOptions[1].strike === middleStrike &&
        callOptions[0].strike === middleStrike &&
        putOptions[0].strike === outerStrikes[0] &&
        callOptions[1].strike === outerStrikes[1]

      if (isIronButterfly) {
        const isLongIronButterfly =
          putOptions[1].orderType === OrderType.OPEN_LONG &&
          callOptions[0].orderType === OrderType.OPEN_LONG &&
          putOptions[0].orderType === OrderType.OPEN_SHORT &&
          callOptions[1].orderType === OrderType.OPEN_SHORT
        const isShortIronButterfly =
          putOptions[1].orderType === OrderType.OPEN_SHORT &&
          callOptions[0].orderType === OrderType.OPEN_SHORT &&
          putOptions[0].orderType === OrderType.OPEN_LONG &&
          callOptions[1].orderType === OrderType.OPEN_LONG

        if (isLongIronButterfly) {
          return PositionStrategyType.LONG_IRON_BUTTERFLY
        } else if (isShortIronButterfly) {
          return PositionStrategyType.SHORT_IRON_BUTTERFLY
        }
      }
    }

    const allStrikes = options.map(o => o.strike).sort((a, b) => a - b)
    if (calls.length === 4) {
      if (
        longOptions.length === 2 &&
        shortOptions.length === 2 &&
        allStrikes[0] < allStrikes[1] &&
        allStrikes[1] < allStrikes[2] &&
        allStrikes[2] < allStrikes[3]
      ) {
        return PositionStrategyType.LONG_CONDOR
      } else {
        return PositionStrategyType.SHORT_CONDOR
      }
    }
    // TODO Check for all put 4 strategies

    if (allStrikes.length === 3) {
      if (
        longOptions.length === 2 &&
        shortOptions.length === 1 &&
        hasAButterflyRatio(options)
      ) {
        return PositionStrategyType.LONG_BUTTERFLY
      } else if (
        longOptions.length === 1 &&
        shortOptions.length === 2 &&
        hasAButterflyRatio(options)
      ) {
        return PositionStrategyType.SHORT_BUTTERFLY
      }
    }
  } else if (options.length === 3) {
    const callOptions = calls.slice().sort((a, b) => a.strike - b.strike)
    const putOptions = puts.slice().sort((a, b) => a.strike - b.strike)
    const allOptions = options.slice().sort((a, b) => a.strike - b.strike)

    const uniqueStrikes = Array.from(new Set(allOptions.map(o => o.strike)))

    if (uniqueStrikes.length === 3) {
      // Long Butterfly with Calls
      if (callOptions.length === 3) {
        const longCount = callOptions.filter(
          o => o.orderType === OrderType.OPEN_LONG
        ).length
        const shortCount = callOptions.filter(
          o => o.orderType === OrderType.OPEN_SHORT
        ).length

        if (
          longCount === 2 &&
          shortCount === 1 &&
          hasAButterflyRatio(options)
        ) {
          return PositionStrategyType.LONG_BUTTERFLY
        } else if (
          longCount === 1 &&
          shortCount === 2 &&
          hasAButterflyRatio(options)
        ) {
          return PositionStrategyType.SHORT_BUTTERFLY
        }
      }

      // Short Butterfly with Puts
      if (putOptions.length === 3) {
        const longCount = putOptions.filter(
          o => o.orderType === OrderType.OPEN_LONG
        ).length
        const shortCount = putOptions.filter(
          o => o.orderType === OrderType.OPEN_SHORT
        ).length

        if (
          longCount === 2 &&
          shortCount === 1 &&
          hasAButterflyRatio(options)
        ) {
          return PositionStrategyType.LONG_BUTTERFLY
        } else if (
          longCount === 1 &&
          shortCount === 2 &&
          hasAButterflyRatio(options)
        ) {
          return PositionStrategyType.SHORT_BUTTERFLY
        }
      }

      return PositionStrategyType.CUSTOM
    }
  }

  // Identify short versions of straddles and strangles
  if (options.length === 2) {
    const [option1, option2] = options
    if (option1.contractType !== option2.contractType) {
      if (option1.strike === option2.strike) {
        return option1.orderType === OrderType.OPEN_SHORT
          ? PositionStrategyType.SHORT_STRADDLE
          : PositionStrategyType.LONG_STRADDLE
      } else {
        return option1.orderType === OrderType.OPEN_SHORT
          ? PositionStrategyType.SHORT_STRANGLE
          : PositionStrategyType.LONG_STRANGLE
      }
    }
  }

  return PositionStrategyType.CUSTOM
}

export function buildOptionLegs(
  ticker: Ticker,
  strikes: number[],
  positionType: PositionStrategy,
  expiration: number,
  orderType: OrderType
): Option[] {
  const optionsCopy = Array.from(strikes)
  const sortedStrikes = optionsCopy.sort((a, b) => a - b)

  if (sortedStrikes.length === 1) {
    // Single legged position
    const strike = sortedStrikes[0]
    const isCall = positionType === PositionStrategy.CALL
    const legs: Option = {
      ticker: ticker,
      contractType: isCall ? ContractType.CALL : ContractType.PUT,
      orderType: orderType,
      strike: strike,
      readableExpiration: getTimeUTC(expiration).readableTimestamp,
      expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
      quantity: 1,
      greeks: null,
      price: null
    }

    return [legs]
  }

  if (sortedStrikes.length === 2) {
    // Vertical Spread Position
    const [leg1, leg2] = sortedStrikes

    const isCall = positionType === PositionStrategy.CALL_SPREAD
    const isCallDebitSpread =
      isCall &&
      (orderType === OrderType.OPEN_LONG || orderType === OrderType.CLOSE_LONG)

    const legs: Option[] = [
      {
        ticker: ticker,
        contractType: isCall ? ContractType.CALL : ContractType.PUT,
        orderType: OrderType.OPEN_LONG,
        strike: isCallDebitSpread ? leg1 : leg2,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      },
      {
        ticker: ticker,
        contractType: isCall ? ContractType.CALL : ContractType.PUT,
        orderType: OrderType.OPEN_SHORT,
        strike: isCallDebitSpread ? leg2 : leg1,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      }
    ]

    return legs
  }

  if (sortedStrikes.length === 3) {
    // Custom 3 legged position
    const [leg1, leg2, leg3] = sortedStrikes

    const isLongButterfly =
      positionType === PositionStrategy.BUTTERFLY &&
      (orderType === OrderType.OPEN_LONG || orderType === OrderType.CLOSE_LONG)

    const legs: Option[] = [
      {
        ticker: ticker,
        contractType: ContractType.CALL,
        orderType: isLongButterfly ? OrderType.OPEN_LONG : OrderType.OPEN_SHORT,
        strike: leg1,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      },
      {
        ticker: ticker,
        contractType: ContractType.CALL,
        orderType: isLongButterfly ? OrderType.OPEN_SHORT : OrderType.OPEN_LONG,
        strike: leg2,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 2,
        greeks: null,
        price: null
      },
      {
        ticker: ticker,
        contractType: ContractType.CALL,
        orderType: isLongButterfly ? OrderType.OPEN_LONG : OrderType.OPEN_SHORT,
        strike: leg3,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      }
    ]

    return legs
  }

  if (sortedStrikes.length === 4) {
    // Iron Condor
    const [leg1, leg2, leg3, leg4] = sortedStrikes
    const isLongIronCondor =
      positionType === PositionStrategy.IRON_CONDOR &&
      (orderType === OrderType.OPEN_LONG || orderType === OrderType.CLOSE_LONG)

    const legs: Option[] = [
      {
        ticker: ticker,
        contractType: ContractType.PUT,
        orderType: isLongIronCondor
          ? OrderType.OPEN_SHORT
          : OrderType.OPEN_LONG,
        strike: leg1,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      },
      {
        ticker: ticker,
        contractType: ContractType.PUT,
        orderType: isLongIronCondor
          ? OrderType.OPEN_LONG
          : OrderType.OPEN_SHORT,
        strike: leg2,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      },
      {
        ticker: ticker,
        contractType: ContractType.CALL,
        orderType: isLongIronCondor
          ? OrderType.OPEN_LONG
          : OrderType.OPEN_SHORT,
        strike: leg3,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      },
      {
        ticker: ticker,
        contractType: ContractType.CALL,
        orderType: isLongIronCondor
          ? OrderType.OPEN_SHORT
          : OrderType.OPEN_LONG,
        strike: leg4,
        readableExpiration: getTimeUTC(expiration).readableTimestamp,
        expirationTimestamp: getTimeUTC(expiration).millisTimestamp,
        quantity: 1,
        greeks: null,
        price: null
      }
    ]

    return legs
  }

  return []
}

/**

Converts a position strategy type to a general position strategy.
@param positionStrategyType The position strategy type.
@returns The corresponding general position strategy.
*/
export function convertToGeneralPositionType(
  positionStrategyType: PositionStrategyType
): PositionStrategy {
  switch (positionStrategyType) {
    case PositionStrategyType.LONG_CALL:
    case PositionStrategyType.SHORT_CALL:
      return PositionStrategy.CALL
    case PositionStrategyType.SHORT_PUT:
    case PositionStrategyType.LONG_PUT:
      return PositionStrategy.PUT
    case PositionStrategyType.PUT_DEBIT_SPREAD:
    case PositionStrategyType.PUT_CREDIT_SPREAD:
      return PositionStrategy.PUT_SPREAD
    case PositionStrategyType.CALL_DEBIT_SPREAD:
    case PositionStrategyType.CALL_CREDIT_SPREAD:
      return PositionStrategy.CALL_SPREAD
    case PositionStrategyType.LONG_IRON_CONDOR:
    case PositionStrategyType.SHORT_IRON_CONDOR:
      return PositionStrategy.IRON_CONDOR
    case PositionStrategyType.LONG_BUTTERFLY:
    case PositionStrategyType.SHORT_BUTTERFLY:
      return PositionStrategy.BUTTERFLY
    case PositionStrategyType.LONG_STRADDLE:
    case PositionStrategyType.SHORT_STRADDLE:
      return PositionStrategy.STRADDLE
    case PositionStrategyType.LONG_STRANGLE:
    case PositionStrategyType.SHORT_STRANGLE:
      return PositionStrategy.STRANGLE
    default:
      return PositionStrategy.CUSTOM
  }
}

/**
 * Determines the order type based on the given position strategy type and open position flag.
 * @param positionStrategyType The type of position strategy.
 * @param openPosition Specifies whether the position is open (true) or closed (false). Defaults to true.
 * @returns The corresponding order type based on the position strategy type and open position flag.
 * @throws {UNSUPPORTED_POSITION_ERROR} If the position strategy type is not supported.
 */
export function getOrderTypeFromPositionType(
  positionStrategyType: PositionStrategyType,
  openPosition = true
): OrderType {
  switch (positionStrategyType) {
    case PositionStrategyType.LONG_CALL:
    case PositionStrategyType.LONG_PUT:
    case PositionStrategyType.CALL_DEBIT_SPREAD:
    case PositionStrategyType.PUT_DEBIT_SPREAD:
    case PositionStrategyType.LONG_BUTTERFLY:
    case PositionStrategyType.LONG_IRON_CONDOR:
      return openPosition ? OrderType.OPEN_LONG : OrderType.CLOSE_LONG
    case PositionStrategyType.SHORT_CALL:
    case PositionStrategyType.SHORT_PUT:
    case PositionStrategyType.CALL_CREDIT_SPREAD:
    case PositionStrategyType.PUT_CREDIT_SPREAD:
    case PositionStrategyType.SHORT_BUTTERFLY:
    case PositionStrategyType.SHORT_IRON_CONDOR:
      return openPosition ? OrderType.OPEN_SHORT : OrderType.CLOSE_SHORT
    default:
      throw UNSUPPORTED_POSITION_ERROR
  }
}

/**
 * Determine the option leg type based on the contract type and order type.
 * @param contractType The contract type.
 * @param orderType The order type.
 * @returns The corresponding option leg type.
 */
export function determineOptionLegType(
  contractType: ContractType,
  orderType: OrderType
) {
  if (contractType === ContractType.CALL) {
    return orderType === OrderType.OPEN_LONG ||
      orderType === OrderType.CLOSE_LONG
      ? PositionStrategyType.LONG_CALL
      : PositionStrategyType.SHORT_CALL
  } else {
    return orderType === OrderType.OPEN_LONG ||
      orderType === OrderType.CLOSE_LONG
      ? PositionStrategyType.LONG_PUT
      : PositionStrategyType.SHORT_PUT
  }
}

/**
 * Checks if the given options have a butterfly ratio.
 * @param options An array of options.
 * @returns A boolean indicating if the options have a butterfly ratio.
 */
function hasAButterflyRatio(options: Option[]): boolean {
  if (options.length !== 3) {
    return false // Not enough options to compare
  }

  const [first, second, third] = options

  return (
    first.quantity === third.quantity && second.quantity === 2 * first.quantity
  )
}

/**
 * Checks if the given options have a 1:1 quantity ratio.
 * @param options An array of options.
 * @returns A boolean indicating if the options have a 1:1 quantity ratio.
 */
function hasAOneToOneRatio(options: Option[]): boolean {
  if (options.length < 2) {
    return false // Not enough options to compare
  }

  const firstQuantity = options[0].quantity
  for (let i = 1; i < options.length; i++) {
    if (options[i].quantity !== firstQuantity) {
      return false // Quantity does not have a 1:1 ratio
    }
  }

  return true // Quantity has a 1:1 ratio for all options
}

/**
 * Checks if the given options have unique strikes.
 * @param options An array of options.
 * @returns A boolean indicating if the options have unique strikes.
 */
function hasUniqueStrikes(options: Option[]): boolean {
  const strikesSet = new Set<number>()

  for (const option of options) {
    if (strikesSet.has(option.strike)) {
      return false // Duplicate strike found
    }

    strikesSet.add(option.strike)
  }

  return true // All strikes are unique
}
