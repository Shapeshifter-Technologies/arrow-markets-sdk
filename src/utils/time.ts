import { BigNumber } from 'ethers'
import { getCurrentTimeUTC, getExpirationTimestamp } from '../common/utils/time'

/**
 * Converts a Unix timestamp in seconds to nanoseconds.
 *
 * @param unixTimestampInSeconds - The Unix timestamp in seconds.
 * @returns The equivalent timestamp in nanoseconds.
 */
export function convertUnixToNanoseconds(unixTimestampInSeconds: number) {
  return unixTimestampInSeconds * 1e9 // 1e9 nanoseconds in a second
}

export function getBigNumberNanoSecFromSec(sec: BigNumber) {
  const num = BigNumber.from(10 ** 9)
  const ns = sec.mul(num)

  return ns
}

/**
 * Calculates the signature timestamps in both nanoseconds and BigNumber formats.
 *
 * @returns An object containing the signature timestamp in nanoseconds and as a BigNumber.
 */
export function getSignatureTimestamps(): {
  signatureTimestamp: number
  bigNumberSignatureTimestamp: BigNumber
} {
  const signatureTimestampUnix = getCurrentTimeUTC().unixTimestamp
  const signatureTimestampNanoSecond = convertUnixToNanoseconds(
    signatureTimestampUnix
  )
  const bigNumberSignatureTimestamp = getBigNumberNanoSecFromSec(
    BigNumber.from(signatureTimestampUnix)
  )

  return {
    signatureTimestamp: signatureTimestampNanoSecond,
    bigNumberSignatureTimestamp
  }
}

/**
 * Calculates the expiration timestamp in both nanoseconds and BigNumber formats.
 *
 * @param readableExpiration - The human-readable expiration date in "MMDDYYYY" format.
 * @returns An object containing the expiration timestamp in nanoseconds and as a BigNumber.
 */
export function getExpirationTimestamps(readableExpiration: string): {
  expirationTimestamp: number
  bigNumberExpirationTimestamp: BigNumber
} {
  const expirationTimestamp = convertUnixToNanoseconds(
    getExpirationTimestamp(readableExpiration).unixTimestamp
  )
  const bigNumberExpirationTimestamp = getBigNumberNanoSecFromSec(
    BigNumber.from(getExpirationTimestamp(readableExpiration).unixTimestamp)
  )

  return { expirationTimestamp, bigNumberExpirationTimestamp }
}

/**
 * Converts a timestamp in milliseconds to ISO 8601 format.
 * @param {string} readableExpiration - A string representing a readable expiration date and time.
 * @returns {string} - The ISO 8601 formatted date and time string.
 */
export function readableTimestampToISO8601(readableExpiration: string): string {
  const timestamp = getExpirationTimestamp(readableExpiration).millisTimestamp
  const date = new Date(timestamp)
  const isoString = date.toISOString().replace('Z', '')

  return isoString
}

export function convertTickerDateFormat(inputDate: string) {
  const year = inputDate.substring(0, 4)
  const month = inputDate.substring(4, 6)
  const day = inputDate.substring(6, 8)

  return `${month}${day}${year}`
}
