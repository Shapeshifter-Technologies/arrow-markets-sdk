import { error } from 'console'
import { ChartData, Option, Position } from '../arrow-common'
import { ContractType, OrderType, PositionStrategyType } from '../types/option'
import {
  determineOptionLegType,
  determinePositionStrategyType
} from './parsing'
import {
  ERROR_COMPUTING_BREAKEVEN,
  ERROR_COMPUTING_PROFIT_LOSS,
  UNSUPPORTED_POSITION_ERROR
} from '../types/exceptions'
import { calculateTotalPL, computePriceOfPosition } from './option'

/**
 * Generate an option profit and loss chart based on the provided options and total chart points.
 * @param options An array of options.
 * @param totalChartPoints The total number of chart points to generate. Defaults to 5000.
 * @returns An object containing the following properties:
 *   - chartData: An array of objects representing the chart data points, with each object containing `x` (underlying price) and `y` (profit/loss) values.
 *   - breakevens: An array of breakeven points along the X-axis (underlying price).
 *   - maxProfit: The maximum profit value in the chart.
 *   - maxProfitX: The corresponding X-axis value (underlying price) for the maximum profit.
 *   - maxLoss: The maximum loss value in the chart.
 *   - maxLossX: The corresponding X-axis value (underlying price) for the maximum loss.
 * @throws ERROR_COMPUTING_PROFIT_LOSSError if unable to compute positions' profit and loss (PnL).
 * @throws UNSUPPORTED_POSITION_ERROR - if the position type is unsupported or invalid.
 * @throws ERROR_COMPUTING_BREAKEVEN - if unable to compute breakeven points.
 */
export const generateOptionProfitAndLossChart = (
  options: Option[],
  totalChartPoints = 5000
) => {
  const xValues: number[] = [] // X-axis values (underlying price)
  const yValues: number[] = [] // Y-axis values (profit/loss)

  // Extract strikes from options
  const strikes = options.map(option => option.strike)

  let maxPrice = 0
  let minPrice = 0

  if (strikes.length > 1) {
    // Get the maximum and minimum strikes
    const maxStrike = Math.max(...strikes)
    const minStrike = Math.min(...strikes)

    // Compute the min and max X axis values
    maxPrice = maxStrike * 1.03
    minPrice = minStrike * 0.97
  } else {
    // Get the maximum and minimum strikes
    const maxStrike = Math.max(...strikes) * 1.4
    const minStrike = Math.min(...strikes) * 0.8

    // Compute the min and max X axis values
    maxPrice = maxStrike * 1.5
    minPrice = minStrike * 0.75
  }

  // Compute the X axis interval
  const interval = maxPrice / totalChartPoints

  for (let price = minPrice; price <= maxPrice; price += interval) {
    const pl = calculateTotalPL(options, price)
    if (pl) {
      xValues.push(price)
      yValues.push(pl)
    } else {
      xValues.push(price)
      yValues.push(0)
    }
  }

  // Add the Y = breakeven values
  let chartData: ChartData[] = xValues.map((_, index) => ({
    x: xValues[index],
    y: yValues[index]
  }))

  const breakevens = findXIntercepts(chartData)
  if (breakevens.length === 0) {
    throw ERROR_COMPUTING_BREAKEVEN
  }

  // Add the strikes as x values and the corresponding y value
  strikes.map(strike => {
    const pl = calculateTotalPL(options, strike)
    xValues.push(strike)
    yValues.push(pl)
  })

  breakevens.forEach(breakeven => {
    xValues.push(breakeven)
    yValues.push(0)
  })

  chartData = xValues.map((_, index) => ({
    x: xValues[index],
    y: yValues[index]
  }))
  chartData.sort((a, b) => a.x - b.x) // Sort chartData based on X values
  const { maxProfit, maxProfitX, maxLoss, maxLossX } = findMaxLossAndMaxProfit(
    options,
    chartData
  )
  return { breakevens, chartData, maxLoss, maxLossX, maxProfit, maxProfitX }
}

/**
 * Calculate the maximum profit, maximum profit X value, maximum loss, and maximum loss X value
 * for a given option strategy based on the provided option legs.
 *
 * @param optionLegs An array of option legs representing the strategy.
 * @returns An object containing the maximum profit, maximum profit X value,
 * maximum loss, and maximum loss X value.
 */
export const findMaxLossAndMaxProfit = (
  optionLegs: Option[],
  chartData: ChartData[]
): {
  maxProfit: number
  maxProfitX: number
  maxLoss: number
  maxLossX: number
} => {
  const positionStrategy = determinePositionStrategyType(optionLegs)
  const positionPrice = computePriceOfPosition(optionLegs)
  let maxProfit = Number.POSITIVE_INFINITY
  let maxProfitX = Number.POSITIVE_INFINITY
  let maxLoss = positionPrice
  let maxLossX = 0
  switch (positionStrategy) {
    case PositionStrategyType.LONG_CALL:
      maxProfit = Number.POSITIVE_INFINITY
      maxProfitX = Number.POSITIVE_INFINITY
      maxLoss = positionPrice
      maxLossX = optionLegs[0].strike
      break
    case PositionStrategyType.SHORT_CALL:
      maxProfit = positionPrice
      maxProfitX = optionLegs[0].strike
      maxLoss = Number.POSITIVE_INFINITY
      maxLossX = Number.POSITIVE_INFINITY
      break
    case PositionStrategyType.LONG_PUT:
      maxProfit = optionLegs[0].strike - positionPrice
      maxProfitX = 0
      maxLoss = positionPrice
      maxLossX = optionLegs[0].strike
      break
    case PositionStrategyType.SHORT_PUT:
      maxProfit = positionPrice
      maxProfitX = optionLegs[0].strike
      maxLoss = Number.POSITIVE_INFINITY
      maxLossX = Number.POSITIVE_INFINITY
      break

    default:
      maxProfit = 0
      for (const data of chartData) {
        if (data.y > maxProfit) {
          maxProfit = data.y
          maxProfitX = data.x
        }
        if (data.y < maxLoss) {
          maxLoss = data.y
          maxLossX = data.x
        }
      }
      maxLoss = Math.abs(maxLoss)
      break
  }
  return { maxLoss, maxLossX, maxProfit, maxProfitX }
}

/**
 * Find the X-axis intercepts (breakeven points) from the provided chart data.
 * @param data The chart data containing X and Y values.
 * @returns An array of X-axis intercepts.
 */
function findXIntercepts(data: ChartData[]): number[] {
  const xIntercepts: number[] = []

  for (let i = 0; i < data.length - 1; i++) {
    const pointA = data[i]
    const pointB = data[i + 1]

    if (pointA.y * pointB.y < 0) {
      const slope = (pointB.y - pointA.y) / (pointB.x - pointA.x)
      const xIntercept = pointA.x - pointA.y / slope
      xIntercepts.push(xIntercept)
    } else if (Math.abs(pointA.y) < Number.EPSILON) {
      xIntercepts.push(pointA.x)
    }
  }

  return xIntercepts
}
