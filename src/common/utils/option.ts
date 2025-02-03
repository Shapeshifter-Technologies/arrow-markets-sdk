import { Position, Option } from '../arrow-common'
import {
  ERROR_COMPUTING_PROFIT_LOSS,
  UNSUPPORTED_POSITION_ERROR
} from '../types/exceptions'
import {
  ContractType,
  OrderType,
  PositionStrategy,
  PositionStrategyType
} from '../types/option'
import {
  determineOptionLegType,
  determinePositionStrategyType
} from './parsing'

/**
 * Determines if an option contract expired in the money or out of the money based on the given position and settlement price.
 *
 * @param position - The position object containing strategy type, order type, and option legs.
 * @param settlementPrice - The price at which the option contract was settled.
 * @returns A boolean indicating whether the option contract expired in the money (true) or out of the money (false).
 * @throws An error if the position strategy type is not one of the valid options.
 */
export function isExpiredInMoney(
  position: Position,
  settlementPrice: number
): boolean {
  const strikes = position.optionLegs.map(leg => leg.strike)
  const minStrike = Math.min(...strikes)
  const maxStrike = Math.max(...strikes)

  switch (position.strategyType) {
    case PositionStrategy.CALL:
      if (
        position.orderType === OrderType.OPEN_LONG ||
        position.orderType === OrderType.CLOSE_LONG
      ) {
        return settlementPrice > maxStrike
      } else {
        return settlementPrice <= maxStrike
      }

    case PositionStrategy.PUT:
      if (
        position.orderType === OrderType.OPEN_LONG ||
        position.orderType === OrderType.CLOSE_LONG
      ) {
        return settlementPrice < minStrike
      } else {
        return settlementPrice >= minStrike
      }

    case PositionStrategy.CALL_SPREAD:
      if (
        position.orderType === OrderType.OPEN_LONG ||
        position.orderType === OrderType.CLOSE_LONG
      ) {
        return settlementPrice > minStrike && settlementPrice <= maxStrike
      } else {
        return settlementPrice <= minStrike || settlementPrice > maxStrike
      }

    case PositionStrategy.PUT_SPREAD:
      if (
        position.orderType === OrderType.OPEN_LONG ||
        position.orderType === OrderType.CLOSE_LONG
      ) {
        return settlementPrice < maxStrike && settlementPrice >= minStrike
      } else {
        return settlementPrice >= maxStrike || settlementPrice < minStrike
      }

    case PositionStrategy.BUTTERFLY:
      if (
        position.orderType === OrderType.OPEN_LONG ||
        position.orderType === OrderType.CLOSE_LONG
      ) {
        return settlementPrice > minStrike && settlementPrice < maxStrike
      } else {
        return settlementPrice <= minStrike || settlementPrice >= maxStrike
      }

    case PositionStrategy.IRON_CONDOR:
      if (
        position.orderType === OrderType.OPEN_LONG ||
        position.orderType === OrderType.CLOSE_LONG
      ) {
        return settlementPrice > minStrike && settlementPrice < maxStrike
      } else {
        return settlementPrice <= minStrike || settlementPrice >= maxStrike
      }

    default:
      throw new Error('Invalid position strategy type.')
  }
}

/**
 * Calculate the profit or loss of an option based on the provided parameters.
 * @param contractType The contract type of the option.
 * @param orderType The order type of the option.
 * @param strike The strike price of the option.
 * @param underlierPrice The price of the underlying asset.
 * @param optionPrice The price of the option.
 * @param contractSize The contract size of the option.
 * @returns The calculated profit or loss of the option.
 * @throws Error if the provided leg type is unsupported.
 */
export function calculateOptionPL(
  contractType: ContractType,
  orderType: OrderType,
  strike: number,
  underlierPrice: number,
  optionPrice: number,
  contractSize: number
): number {
  const legType = determineOptionLegType(contractType, orderType)
  switch (legType) {
    case 'Long Call':
      return (Math.max(underlierPrice - strike, 0) - optionPrice) * contractSize // Profit
    case 'Long Put':
      return (Math.max(strike - underlierPrice, 0) - optionPrice) * contractSize
    case 'Short Call':
      return (optionPrice - Math.max(0, underlierPrice - strike)) * contractSize // Maximum gain is the premium received
    case 'Short Put':
      return (optionPrice - Math.max(0, strike - underlierPrice)) * contractSize // Maximum gain is the premium received
    default:
      throw UNSUPPORTED_POSITION_ERROR
  }
}

export function calculateOptionRealizedPL(
  contractType: ContractType,
  orderType: OrderType,
  strike: number,
  underlierPrice: number,
  positionPrice: number, // Total position size instead of optionPrice
  contractSize: number
): number {
  const legType = determineOptionLegType(contractType, orderType)
  switch (legType) {
    case 'Long Call':
      return (
        (Math.max(underlierPrice - strike, 0) * positionPrice - positionPrice) *
        contractSize
      ) // Profit
    case 'Long Put':
      return (
        (Math.max(strike - underlierPrice, 0) * positionPrice - positionPrice) *
        contractSize
      )
    case 'Short Call':
      return (
        (positionPrice - Math.max(0, underlierPrice - strike) * positionPrice) *
        contractSize
      ) // Maximum gain is the premium received
    case 'Short Put':
      return (
        (positionPrice - Math.max(0, strike - underlierPrice) * positionPrice) *
        contractSize
      ) // Maximum gain is the premium received
    default:
      throw UNSUPPORTED_POSITION_ERROR
  }
}

/**
 * Calculate the total profit/loss (PL) for the provided options at the given underlying price.
 * @param options An array of options.
 * @param underlierPrice The underlying price.
 * @returns The total profit/loss (PL) for the options.
 * @throws {ERROR_COMPUTING_PROFIT_LOSS} If there is an error computing the profit/loss.
 */
export const calculateTotalPL = (
  options: Option[],
  underlierPrice: number
): number => {
  let totalPL = 0

  for (const option of options) {
    const { contractType, orderType, strike, price, quantity } = option
    const optionPL = calculateOptionPL(
      contractType,
      orderType,
      strike,
      underlierPrice,
      price!,
      quantity
    )
    totalPL += optionPL
  }

  return totalPL
}

export const calculateExpiredPositionRealizedPL = (
  options: Option[],
  underlierPrice: number,
  totalPositionPrice: number
): number => {
  let totalPL = 0
  for (const option of options) {
    const { contractType, orderType, strike, quantity } = option
    const optionPL = calculateOptionRealizedPL(
      contractType,
      orderType,
      strike,
      underlierPrice,
      totalPositionPrice!,
      quantity
    )
    totalPL += optionPL
  }

  return Number(totalPL.toPrecision(2))
}

export const calculateRealizedPL = (
  options: Option[],
  underlierPrice: number
): number => {
  let totalPL = 0
  for (const option of options) {
    const { contractType, orderType, strike, price, quantity } = option
    const optionPL = calculateOptionRealizedPL(
      contractType,
      orderType,
      strike,
      underlierPrice,
      price!,
      quantity
    )
    totalPL += optionPL
  }

  return totalPL
}

/**
 * Computes the realized profit or loss of a position based on the expiration price.
 *
 * @param position - The position object containing option legs and strategy type.
 * @param expirationPrice - The price at which the options expired.
 * @returns The realized profit or loss of the position.
 * @throws An error if there is an issue computing the profit or loss.
 */
export function computeRealizedProfitLoss(
  position: Position,
  expirationPrice: number
): number {
  const optionLegs = position.optionLegs.map(leg => leg)
  const pl = calculateRealizedPL(optionLegs, expirationPrice)
  return Number(pl.toFixed(2))
}

/**
 * Computes the total price of a position based on the provided options.
 * @param options - An array of options representing the position.
 * @param absolute - A boolean value indicating whether to compute the absolute value of the price. Defaults to true.
 * @returns The total price of the position.
 */
export function computePriceOfPosition(options: Option[], absolute = true) {
  let price = 0

  options.map(option => {
    const quantity = option.quantity || 1 // Default to 1 if quantity is not provided

    switch (option.orderType) {
      case OrderType.OPEN_LONG:
      case OrderType.CLOSE_SHORT:
        price += (option.price! as number) * quantity
        break
      case OrderType.CLOSE_LONG:
      case OrderType.OPEN_SHORT:
        price -= (option.price! as number) * quantity
        break
      default:
        break
    }
  })

  if (absolute) {
    return Math.abs(price) // Return the absolute value if 'absolute' is set to true
  } else {
    return price
  }
}

/**
 * Calculate the required collateral for a given options position.
 * @param options An array of Option objects representing the position.
 * @param absolute If true, returns the absolute value of the required collateral.
 * @returns The required collateral amount for the options position.
 */
export function computeRequiredCollateral(options: Option[]) {
  const positionType = determinePositionStrategyType(options)
  const priceOfPosition = computePriceOfPosition(options)
  switch (positionType) {
    case PositionStrategyType.SHORT_CALL:
    case PositionStrategyType.SHORT_PUT:
      return options[0].strike - priceOfPosition
    case PositionStrategyType.CALL_CREDIT_SPREAD:
    case PositionStrategyType.PUT_CREDIT_SPREAD:
      const higherStrike = Math.max(...options.map(option => option.strike))
      const lowerStrike = Math.min(...options.map(option => option.strike))
      return higherStrike - lowerStrike - priceOfPosition
    default:
      return 0
  }
}
