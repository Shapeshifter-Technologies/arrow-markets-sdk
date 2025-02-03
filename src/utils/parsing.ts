import { ethers } from 'ethers'

import type { OptionEntry } from '../types/option'
import type { APIOptionOrderEntry, OptionOrder } from '../types/Post'
import type { ShortFormStrategyType } from '../types/general'
import { AppVersion } from '../types/general'
import { ChainIds } from '../types/web3'
import {
  ContractType,
  OrderType,
  PositionStrategy,
  PositionStrategyType
} from '../common/types/option'
import type { Option } from '../common/arrow-common'
import { Network } from '../common/types/general'
import {
  convertToGeneralPositionType,
  determinePositionStrategyType
} from '../common/utils/parsing'
import { getExpirationTimestamp } from '../common/utils/time'

/**
 * Checks if all options in the array have the same contract type.
 *
 * @param options - An array of Option objects to check.
 * @returns A boolean indicating whether all options have the same contract type.
 * @throws Error if the input array is empty.
 */
export function hasSameContractType(options: Option[]): boolean {
  if (options.length === 0) {
    throw new Error('Array is empty.')
  }

  const firstContractType = options[0].contractType

  for (let i = 1; i < options.length; i++) {
    if (options[i].contractType !== firstContractType) {
      return false
    }
  }

  return true
}

/**
 * Prepares strike information based on position strategy and decimals.
 *
 * @param optionLegs - An array of Option objects.
 * @param positionStrategy - The position strategy.
 * @param decimals - The number of decimal places.
 * @returns An object containing formatted strikes and parsed BigNumber strikes.
 */
export function prepareStrikes(
  optionLegs: Option[],
  positionStrategy: PositionStrategy,
  decimals: number
) {
  const arrayOfStrikes = optionLegs.map(optionLeg =>
    Number(optionLeg.strike.toFixed(2))
  )

  // If there's only one strike, add a second item with value 0
  if (arrayOfStrikes.length === 1) {
    arrayOfStrikes.push(0)
  }

  if (arrayOfStrikes[1] !== 0) {
    if (positionStrategy === PositionStrategy.CALL_SPREAD) {
      arrayOfStrikes.sort()
    } else if (positionStrategy === PositionStrategy.PUT_SPREAD) {
      arrayOfStrikes.sort().reverse()
    }
  }
  const bigNumberStrikes = parseNumberStrikes(arrayOfStrikes, decimals)

  const strikesString = arrayOfStrikes.join('|')

  return { arrayOfStrikes, strikesString, bigNumberStrikes }
}

/**
 * Prepares the order quantity by parsing it to BigNumber.
 *
 * @param quantity - The order quantity.
 * @param decimals - The number of decimal places.
 * @returns The parsed order quantity as BigNumber.
 */
export function prepareOrderQuantity(
  quantity: number,
  decimals = 2
): ethers.BigNumber {
  return ethers.utils.parseUnits(quantity.toString(), decimals)
}
/**
 * Parses an array of number strikes into an array of BigNumber strikes using the provided decimals.
 *
 * @param numberStrikes - An array of number strikes.
 * @param decimals - The number of decimal places to consider.
 * @returns An array of BigNumber strikes.
 */
function parseNumberStrikes(
  numberStrikes: number[],
  decimals: number
): ethers.BigNumber[] {
  const parsedStrikes = numberStrikes.map(strike =>
    ethers.utils.parseUnits(strike.toString(), decimals)
  )

  return parsedStrikes
}

/**
 * Prepares an array of Option objects for API submission by transforming them into OptionEntry objects.
 *
 * @param options - An array of Option objects.
 * @returns An array of OptionEntry objects.
 */
function prepareOptionsForAPI(options: Option[]): OptionEntry[] {
  const optionEntries: OptionEntry[] = []

  for (const option of options) {
    const contractTypeMap: { [key: number]: 'C' | 'P' } = {
      0: 'C',
      1: 'P',
      2: 'C',
      3: 'P'
    }

    const formattedDate = new Date(option.expirationTimestamp)
    formattedDate.setUTCHours(8, 0, 0, 0) // Set the time to 08:00:00 UTC

    const entry: OptionEntry = {
      contract_type: contractTypeMap[option.contractType],
      expiration: formattedDate.toISOString().replace('Z', ''),
      strike: option.strike.toString()
    }

    optionEntries.push(entry)
  }

  return optionEntries
}

/**
 * Prepares the parameters for submitting an option order to the API.
 *
 * @param options - An array of Option objects.
 * @param orderType - The type of the order.
 * @param quantity - The quantity of the order.
 * @param senderAddress - The sender's Ethereum address.
 * @param signature - The signature of the order.
 * @param signatureTimestamp - The timestamp of the signature in nanoseconds.
 * @param signatureTimestamp - The deadline of the transaction in nanoseconds.
 * @param threshold_price - The threshold price.
 * @param networkVersion - The network version.
 *
 * @returns Prepared array of APIOptionOrderEntry items ready for submission
 */
export function prepareOrderForSubmission(
  orders: OptionOrder[],
  networkVersion: Network,
  device = '',
  mode = ''
): APIOptionOrderEntry[] {
  const parsedOrders: APIOptionOrderEntry[] = []

  orders.map(order => {
    const {
      options,
      orderType,
      quantity,
      senderAddress,
      signature,
      transactionDeadline,
      signatureTimestamp,
      threshold_price
    } = order
    const positionType = convertToGeneralPositionType(
      determinePositionStrategyType(options)
    )

    let optionsForApi = prepareOptionsForAPI(options)
    if (positionType === PositionStrategy.CALL_SPREAD) {
      optionsForApi = optionsForApi.sort(
        (a, b) => Number(a.strike) - Number(b.strike)
      )
    } else if (positionType === PositionStrategy.PUT_SPREAD) {
      optionsForApi = optionsForApi.sort(
        (a, b) => Number(b.strike) - Number(a.strike)
      )
    }

    const preparedParams: APIOptionOrderEntry = {
      position_id: order.positionId,
      chain_id: ChainIds[networkVersion],
      option: optionsForApi,
      underlying: options[0].ticker,
      order_type: orderType,
      quantity: quantity.toString(),
      sender_address: senderAddress,
      signature: signature,
      transaction_deadline: transactionDeadline,
      signature_timestamp: signatureTimestamp,
      threshold_price: threshold_price.toString(),
      device: device,
      mode: mode
    }

    parsedOrders.push(preparedParams)
  })

  return parsedOrders
}

/**
 * Converts a contract type enumeration to a Market Maker contract type string.
 * @param input - The contract type to be converted.
 * @returns 'C' for CALL, 'P' for PUT.
 */
export function convertToMarketMakerContractType(
  input: ContractType
): 'C' | 'P' {
  if (input === ContractType.CALL) {
    return 'C'
  } else {
    return 'P'
  }
}

/**
 * Determines the trading side (Buy or Sell) based on an order type enumeration.
 * @param input - The order type to be analyzed.
 * @returns 'Buy' for OPEN_LONG or CLOSE_SHORT, 'Sell' otherwise.
 */
export function getSideFromOrderType(input: OrderType): 'Buy' | 'Sell' {
  if (input === OrderType.OPEN_LONG || input === OrderType.CLOSE_SHORT) {
    return 'Buy'
  } else {
    return 'Sell'
  }
}

/**
 * Determine the order type based on a given position strategy type.
 *
 * @param input - The position strategy type to determine the order type for.
 * @returns The corresponding order type based on the input position strategy.
 *
 * @example
 * const strategyType = PositionStrategyType.CALL_CREDIT_SPREAD;
 * const orderType = determinePositionOrderType(strategyType);
 * // Returns: OrderType.OPEN_SHORT
 */
export function determinePositionOrderType(
  input: PositionStrategyType
): OrderType {
  if (
    [
      PositionStrategyType.CALL_CREDIT_SPREAD,
      PositionStrategyType.PUT_CREDIT_SPREAD,
      PositionStrategyType.SHORT_CALL,
      PositionStrategyType.SHORT_PUT
    ].includes(input)
  ) {
    return OrderType.OPEN_SHORT
  } else {
    return OrderType.OPEN_LONG
  }
}

export function checkAppVersionNetworkVersion(
  appVersion: AppVersion,
  networkVersion: Network
) {
  if (
    (appVersion === AppVersion.TESTNET && networkVersion === Network.Mainnet) ||
    (appVersion === AppVersion.MAINNET && networkVersion === Network.Testnet) ||
    (appVersion === AppVersion.COMPETITION &&
      networkVersion === Network.Mainnet)
  ) {
    throw new Error('Unsupported combination of AppVersion and Network')
  }
}

/**
 * Sorts an array of decimal numbers in ascending order and returns them as a string joined by '|' for use with smart contracts.
 *
 * @param {number[]} strikes - An array of decimal numbers to be sorted and joined.
 * @returns {string} A string containing the sorted numbers joined by '|'.
 *
 * @example
 * const strikes = [3.5, 1.2, 2.8, 0.9];
 * const result = getDecimalStrikeString(strikes);
 * console.log(result); // Output: "0.9|1.2|2.8|3.5"
 */
export function getDecimalStrikeString(strikes: number[]): string {
  // Check if there's only one element in the array
  if (strikes.length === 1) {
    strikes.push(0)
  }

  const nonZeroStrikes = strikes.filter(strike => strike !== 0)
  const zeroStrikes = strikes.filter(strike => strike === 0)

  const sortedStrikes = nonZeroStrikes.concat(zeroStrikes)

  return sortedStrikes.join('|')
}

export function generateMarketMakerSymbol(options: Option[]) {
  if (options.length === 0) return ''
  else {
    const expirationDate = new Date(
      getExpirationTimestamp(options[0].readableExpiration).millisTimestamp
    )
    const strikes = options.map(leg => leg.strike.toFixed(2)) // Ensure two decimal places
    const formattedExpiration = expirationDate
      .toISOString()
      .substring(0, 10)
      .replace(/-/g, '')
    const formattedStrikes = strikes.join('-')
    const strategyType = convertToGeneralPositionType(
      determinePositionStrategyType(options)
    )

    return `${
      options[0].ticker
    }-${formattedExpiration}-${formattedStrikes}-${getShortFormStrategyType(
      strategyType
    )}`
  }
}

const getShortFormStrategyType = (
  strategyType: PositionStrategy
): 'C' | 'P' | 'CS' | 'PS' | '' => {
  switch (strategyType) {
    case PositionStrategy.CALL:
      return 'C'
    case PositionStrategy.PUT:
      return 'P'
    case PositionStrategy.CALL_SPREAD:
      return 'CS'
    case PositionStrategy.PUT_SPREAD:
      return 'PS'
    default:
      return ''
  }
}

export const getLongFormStrategyType = (shortForm: ShortFormStrategyType) => {
  switch (shortForm) {
    case 'C':
      return PositionStrategy.CALL
    case 'P':
      return PositionStrategy.PUT
    case 'CS':
      return PositionStrategy.CALL_SPREAD
    case 'PS':
      return PositionStrategy.PUT_SPREAD
    default:
      return ''
  }
}
