import type { ChartData, Option } from '../arrow-common'
import { ContractType, OrderType, PositionStrategyType } from '../types/option'
import {
  determineOptionLegType,
  determinePositionStrategyType
} from './parsing'

export function callMaxValues(
  strikePrice: number,
  premium: number,
  isShort: boolean
): { maxLoss: { x: number; y: number }; maxProfit: { x: number; y: number } } {
  if (isShort) {
    return {
      maxLoss: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY },
      maxProfit: { x: strikePrice, y: premium }
    }
  } else {
    return {
      maxLoss: { y: premium, x: strikePrice },
      maxProfit: { y: Number.POSITIVE_INFINITY, x: Number.POSITIVE_INFINITY }
    }
  }
}

export function putMaxValues(
  strikePrice: number,
  premium: number,
  isShort: boolean
): { maxLoss: { x: number; y: number }; maxProfit: { x: number; y: number } } {
  if (isShort) {
    return {
      maxLoss: { x: 0, y: Number.POSITIVE_INFINITY },
      maxProfit: { x: strikePrice, y: premium }
    }
  } else {
    return {
      maxLoss: { x: 0, y: premium },
      maxProfit: { x: strikePrice, y: strikePrice - premium }
    }
  }
}

export function getCritialPointOfOption(option: Option) {
  let criticalPoint = 0
  if (option.contractType === ContractType.CALL) {
    const callMaxValues_ = callMaxValues(
      option.strike,
      option.price!,
      [OrderType.OPEN_SHORT, OrderType.CLOSE_SHORT].includes(option.orderType)
    )
    criticalPoint = Math.min(
      callMaxValues_.maxLoss.x,
      callMaxValues_.maxProfit.x
    )
  } else {
    const putMaxValues_ = putMaxValues(
      option.strike,
      option.price!,
      [OrderType.OPEN_SHORT, OrderType.CLOSE_SHORT].includes(option.orderType)
    )
    criticalPoint = Math.min(putMaxValues_.maxLoss.x, putMaxValues_.maxProfit.x)
  }

  return criticalPoint
}

function onlyUnique(value: number, index: number, array: number[]) {
  return array.indexOf(value) === index
}

export function getCritialPointOfOptions(options: Option[]) {
  const arrayOfCritialPoints = options.map(option => {
    let criticalPoint = 0
    if (option.contractType === ContractType.CALL) {
      const callMaxValues_ = callMaxValues(
        option.strike,
        option.price!,
        [OrderType.OPEN_SHORT, OrderType.CLOSE_SHORT].includes(option.orderType)
      )
      criticalPoint = Math.min(
        callMaxValues_.maxLoss.x,
        callMaxValues_.maxProfit.x
      )
    } else {
      const putMaxValues_ = putMaxValues(
        option.strike,
        option.price!,
        [OrderType.OPEN_SHORT, OrderType.CLOSE_SHORT].includes(option.orderType)
      )
      criticalPoint = Math.max(
        putMaxValues_.maxLoss.x,
        putMaxValues_.maxProfit.x
      )
    }

    return criticalPoint
  })

  return arrayOfCritialPoints.sort((a, b) => a - b).filter(onlyUnique)
}

const extendByPercent = (value: number, percent = 0.5): number =>
  value * percent

export function fillArrayWithValues(arr: number[]): number[] {
  if (arr.length === 0) return []

  arr.sort((a, b) => a - b)

  // To store the filled values
  const filledValues: number[] = []

  // Fill the array if there's only one element
  if (arr.length === 1) {
    const value = arr[0]
    const extension = extendByPercent(value)
    filledValues.push(value - extension)

    // Generate values between (value - extension) and (value + extension)
    for (let i = -extension; i <= extension; i += extension / 10) {
      filledValues.push(value + i)
    }

    filledValues.push(value + extension)

    return filledValues
  }

  // Extend and fill values between each pair of elements
  for (let i = 0; i < arr.length - 1; i++) {
    const start = arr[i]
    const end = arr[i + 1]
    const step = (end - start) / 10

    if (i === 0) {
      // Extend to the left of the first element
      const leftExtension = start - extendByPercent(start, 0.05)
      for (let j = leftExtension; j < start; j += step) {
        filledValues.push(j)
      }
    }

    // Fill values between start and end
    for (let j = start; j <= end; j += step) {
      filledValues.push(j)
    }

    if (i === arr.length - 2) {
      // Extend to the right of the last element
      const rightExtension = end + extendByPercent(end, 0.05)
      for (let j = end; j <= rightExtension; j += step) {
        filledValues.push(j)
      }
    }
  }

  return filledValues
}

export function getXValueRange(options: Option[]) {
  const criticalPointsArray = getCritialPointOfOptions(options)

  return fillArrayWithValues(criticalPointsArray)
}

/**
 * Calculates the PnL for a given option at a specified underlying asset price.
 *
 * @param option - The option for which PnL is to be calculated.
 * @param underlyingAssetPrice - The price of the underlying asset.
 * @returns The PnL for the given option at the specified price.
 */
function calculateOptionPnL(
  option: Option,
  underlyingAssetPrice: number
): number {
  const legType = determineOptionLegType(option.contractType, option.orderType)
  let singleOptionPayoff = 0

  const { price: optionPrice, strike, quantity: contractSize } = option

  switch (legType) {
    case 'Long Call':
      singleOptionPayoff =
        (Math.max(underlyingAssetPrice - strike, 0) - optionPrice!) *
        contractSize // Profit
      break
    case 'Long Put':
      singleOptionPayoff =
        (Math.max(strike - underlyingAssetPrice, 0) - optionPrice!) *
        contractSize
      break
    case 'Short Call':
      singleOptionPayoff =
        (optionPrice! - Math.max(0, underlyingAssetPrice - strike)) *
        contractSize // Maximum gain is the premium received
      break
    case 'Short Put':
      singleOptionPayoff =
        (optionPrice! - Math.max(0, strike - underlyingAssetPrice)) *
        contractSize // Maximum gain is the premium received
      break
    default:
  }

  return singleOptionPayoff * option.quantity
}

/**
 * Finds the break-even points, maximum loss, and maximum profit for a given set of options.
 *
 * @param options - The list of options for which analytics is to be calculated.
 * @returns An object containing the chart data, break-even points, maximum loss, and maximum profit.
 */
function calculateTotalPnL(
  options: Option[],
  underlyingAssetPrices: number[]
): ChartData[] {
  const optionPnLData = options.map(option =>
    underlyingAssetPrices.map(price => ({
      x: price,
      y: calculateOptionPnL(option, price)
    }))
  )

  // Combine all PnL data points, ensuring all x values are included
  const combinedPnLData: ChartData[] = []
  underlyingAssetPrices.forEach(price => {
    const totalPnL = optionPnLData.reduce((total, optionData) => {
      const matchingPoint = optionData.find(data => data.x === price)

      return total + (matchingPoint ? matchingPoint.y : 0)
    }, 0)
    combinedPnLData.push({ x: price, y: totalPnL })
  })

  return combinedPnLData
}

export function computeChartData(options: Option[]): {
  chartData: ChartData[]
  breakEvens: number[]
  maxLoss: ChartData
  maxProfit: ChartData
} {
  const underlyingAssetPrices = getXValueRange(options)

  const chartData = calculateTotalPnL(options, underlyingAssetPrices)

  const breakEvens: number[] = []
  let maxLoss = { x: 0, y: Number.POSITIVE_INFINITY }
  let maxProfit = { x: 0, y: Number.NEGATIVE_INFINITY }

  // Calculate break-even points, max loss, and max profit
  for (let i = 1; i < chartData.length; i++) {
    const previousPoint = chartData[i - 1]
    const currentPoint = chartData[i]

    // Identify break-even points
    if (
      (previousPoint.y > 0 && currentPoint.y <= 0) ||
      (previousPoint.y < 0 && currentPoint.y >= 0)
    ) {
      const breakEven =
        previousPoint.x +
        ((currentPoint.x - previousPoint.x) * (0 - previousPoint.y)) /
          (currentPoint.y - previousPoint.y)
      breakEvens.push(breakEven)
    }

    // Track max loss and max profit
    if (currentPoint.y < maxLoss.y) {
      maxLoss = { x: currentPoint.x, y: currentPoint.y }
    }

    if (currentPoint.y > maxProfit.y) {
      maxProfit = { x: currentPoint.x, y: currentPoint.y }
    }
  }

  const positionType = determinePositionStrategyType(options)

  if (positionType === PositionStrategyType.LONG_CALL) {
    maxProfit = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }
    maxLoss = { y: -options[0].price!, x: options[0].strike }
  } else if (positionType === PositionStrategyType.SHORT_CALL) {
    maxLoss = { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY }
    maxProfit = { x: options[0].strike, y: options[0].price! }
  } else if (positionType === PositionStrategyType.LONG_PUT) {
    maxLoss = { x: options[0].strike, y: -options[0].price! } // Loss = premium, happens if price is at or above strike
    maxProfit = { x: 0, y: options[0].strike - options[0].price! } // Profit occurs if price drops to 0
  } else if (positionType === PositionStrategyType.SHORT_PUT) {
    maxLoss = { x: 0, y: -(options[0].strike - options[0].price!) } // Max loss occurs if price drops to 0
    maxProfit = { x: options[0].strike, y: options[0].price! } // Profit = premium, happens if price is at or above strike
  } else {
    if (maxLoss.y === Number.NEGATIVE_INFINITY) {
      // Handle infinite scenarios
      maxLoss = chartData[0] // assume left edge if unlimited loss
    }
    if (maxProfit.y === Number.POSITIVE_INFINITY) {
      maxProfit = chartData[chartData.length - 1] // assume right edge if unlimited profit
    }
  }

  return { chartData, breakEvens, maxLoss, maxProfit }
}
