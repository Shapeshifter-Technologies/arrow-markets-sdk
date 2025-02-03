import type { Option } from '@arrowdfms/arrow-common-sdk'
import {
  ContractType,
  OrderType,
  Ticker
} from '@arrowdfms/arrow-common-sdk/lib/types/option'
import { ethers } from 'ethers'
import {
  getCurrentTimeUTC,
  getTimeUTC
} from '@arrowdfms/arrow-common-sdk/lib/utils/time'
import { NetworkVersion } from '@arrowdfms/arrow-common-sdk/lib/types/general'

import {
  approveSpending,
  depositGasFee,
  getOrderParameters,
  submitRFEOrder
} from '../../src/utils/orders'
import { AppVersion } from '../../src/types/general'
import type { UserPosition } from '../../src/types/option'
import { getArrowTokenContract } from '../../src/utils/web3'

async function main() {
  console.log('About to mint arrow tokens')
  // Create an Ethereum provider for the Avalanche Testnet
  const provider = new ethers.providers.JsonRpcProvider(
    'https://api.avax-test.network/ext/bc/C/rpc'
  )

  // User wallet setup
  const userWallet = new ethers.Wallet(
    'fac1a3bd49e68e7d5c0c70066e4495de70073b80f63f9afe469c93e2e9c6a3f8',
    provider
  )
  const token = await getArrowTokenContract(
    NetworkVersion.Fuji,
    AppVersion.TESTNET,
    userWallet
  )
  console.log('tkn', token)
  const decimals = await token.decimals()
  console.log('decimals', decimals)
  const parsedAmt = ethers.utils.parseUnits('10000', decimals)
  console.log('parsedAmt', parsedAmt)
  const tx = token.mint('0xB8bC52F16726bB3cFBaB1DA6CF22c026DDec577c', parsedAmt)
}

main()
