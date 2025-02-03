import { ethers } from 'ethers'
import type { AppVersion } from '../types/general'
import { providers } from '../types/web3'
import type {
  APRHistoryResponse,
  CurrentStakingAPRResponse,
  EstimateStakingAPRResponse
} from '../types/Get'
import { ArrowApiUrls } from '../types/api'
import { Network } from '../common/types/general'
import { getArrowStakingContract, getArrowTokenContract } from './web3'
import { GET } from './axios'

export async function stakeArrowToken(
  amount: number,
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  const stakingContract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    wallet
  )

  const tokenContract = await getArrowTokenContract(
    networkVersion,
    appVersion,
    wallet
  )

  const parsedAmount = ethers.utils.parseUnits(
    amount.toString(),
    await tokenContract.decimals()
  )

  const stakingTransaction = await stakingContract.stakeArrowToken(parsedAmount)

  return stakingTransaction.hash
}

export async function approveArrowTokens(
  amount: number,
  approverAddress: string,
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer,
  spender?: string
) {
  const contract = await getArrowTokenContract(
    networkVersion,
    appVersion,
    wallet
  )
  const parsedAmount = ethers.utils.parseUnits(
    amount.toString(),
    await contract.decimals()
  )

  const spenderAddress =
    spender ||
    (await getArrowStakingContract(networkVersion, appVersion, wallet)).address

  const currentAllowance = await contract.allowance(
    approverAddress,
    spenderAddress
  )

  if (currentAllowance.lt(parsedAmount)) {
    const arrowTokenApprovalTransaction = await contract.approve(
      spenderAddress,
      parsedAmount
    )

    return arrowTokenApprovalTransaction.hash
  } else {
    return null
  }
}

export async function unstakeArrowToken(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    wallet
  )
  const unstakingTransaction = await contract.unstakeArrowToken()

  return unstakingTransaction.hash
}

export async function cancelUnstakeArrowToken(
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    wallet
  )
  const cancelUnstakeArrowTokenTransaction =
    await contract.cancelUnstakeArrowToken()

  return cancelUnstakeArrowTokenTransaction.hash
}

export async function withdrawArrowToken(
  amountToWithdraw: number,
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    wallet
  )

  const tokenContract = await getArrowTokenContract(
    networkVersion,
    appVersion,
    wallet
  )

  const parsedAmount = ethers.utils.parseUnits(
    amountToWithdraw.toString(),
    await tokenContract.decimals()
  )

  const withdrawArrowTokenTransaction = await contract.withdrawArrowToken(
    parsedAmount
  )

  return withdrawArrowTokenTransaction.hash
}

export async function emergencyWithdrawUnstakedArrowTokenForFee(
  amountToUnstake: number,
  networkVersion: Network,
  appVersion: AppVersion,
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    wallet
  )

  const tokenContract = await getArrowTokenContract(
    networkVersion,
    appVersion,
    wallet
  )

  const parsedAmount = ethers.utils.parseUnits(
    amountToUnstake.toString(),
    await tokenContract.decimals()
  )

  const emergencyWithdrawUnstakedArrowTokenForFeeTransaction =
    await contract.emergencyWithdrawArrowToken(parsedAmount)

  console.log(
    'emergencyWithdrawUnstakedArrowTokenForFeeTransaction',
    emergencyWithdrawUnstakedArrowTokenForFeeTransaction.hash
  )

  return emergencyWithdrawUnstakedArrowTokenForFeeTransaction.hash
}

export async function claimRewards(
  wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer,
  address: string,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    wallet
  )
  const claimRewardsTransaction = await contract.claimRewards()

  return claimRewardsTransaction.hash
}

export async function getTotalArrowTokensStaked(
  networkVersion: Network,
  appVersion: AppVersion
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    providers[networkVersion]
  )

  const arrowTokenContract = await getArrowTokenContract(
    networkVersion,
    appVersion
  )
  const decimals = await arrowTokenContract.decimals()
  let totalStakeAmounts = await contract.totalStakeAmounts()

  totalStakeAmounts = ethers.utils.formatUnits(totalStakeAmounts, decimals)

  return totalStakeAmounts
}

export async function getNextDistributionTimestamp(
  networkVersion: Network,
  appVersion: AppVersion
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    providers[networkVersion]
  )

  let lastRewardsTime = await contract.lastRewardsTime()
  let rewardIntervals = await contract.rewardIntervals()
  lastRewardsTime = lastRewardsTime.toNumber() * 1000
  rewardIntervals = rewardIntervals.toNumber() * 1000

  // Returns the next distrubution timestamp in seconds
  return {
    lastRewardsTime: lastRewardsTime as number,
    rewardIntervals: rewardIntervals as number
  }
}

export async function getStakingAmountOfAddress(
  address: string,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    providers[networkVersion]
  )

  let stakingAmountOfUser = await contract.getStakingAmount(address)

  const arrowTokenContract = await getArrowTokenContract(
    networkVersion,
    appVersion
  )

  const decimals = await arrowTokenContract.decimals()

  stakingAmountOfUser = ethers.utils.formatUnits(stakingAmountOfUser, decimals)

  return Number(stakingAmountOfUser)
}

export async function getUnStakedAmountsAmountOfAddress(
  address: string,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    providers[networkVersion]
  )
  let daysRemaining = 0
  let unStakedAmountsOfUser = await contract.unStakedAmounts(address)

  try {
    daysRemaining = (await contract.getUnstakeLockedDays(address)).toNumber()
  } catch (error) {
    daysRemaining = 0
  }

  const arrowTokenContract = await getArrowTokenContract(
    networkVersion,
    appVersion
  )

  const decimals = await arrowTokenContract.decimals()

  unStakedAmountsOfUser = ethers.utils.formatUnits(
    unStakedAmountsOfUser,
    decimals
  )

  return {
    unStakedAmountsOfUser: Number(unStakedAmountsOfUser),
    daysRemaining: Number(daysRemaining)
  }
}

export async function getRewardAmountOfAddress(
  address: string,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    providers[networkVersion]
  )

  let getRewardAmountOfUser = await contract.getRewardAmount(address)

  const arrowTokenContract = await getArrowTokenContract(
    networkVersion,
    appVersion
  )

  const decimals = await arrowTokenContract.decimals()

  getRewardAmountOfUser = ethers.utils.formatUnits(
    getRewardAmountOfUser,
    decimals
  )

  return Number(getRewardAmountOfUser)
}

export async function getEarlyWithdrawalPenaltyFees(
  networkVersion: Network,
  appVersion: AppVersion
) {
  const contract = await getArrowStakingContract(
    networkVersion,
    appVersion,
    providers[networkVersion]
  )

  let earlyWithdrawalPenaltyFees = await contract.earlyWithdrawalPenaltyFees()
  const percentDecimals = await contract.percentDecimals()

  earlyWithdrawalPenaltyFees = earlyWithdrawalPenaltyFees / percentDecimals

  return Number(earlyWithdrawalPenaltyFees)
}

export async function getCurrentStakingAPR(
  networkVersion: Network,
  appVersion: AppVersion
) {
  const url = ArrowApiUrls[appVersion][networkVersion]

  const { data: response } = await GET<CurrentStakingAPRResponse>(
    url + '/staking/current-apr',
    {
      params: {
        chain_id: networkVersion === Network.Testnet ? 43113 : 43114
      }
    }
  )

  return response.apr
}

export async function estimateStakingAPR(
  amountToStake: number,
  networkVersion: Network,
  appVersion: AppVersion
) {
  const url = ArrowApiUrls[appVersion][networkVersion]

  const { data: response } = await GET<EstimateStakingAPRResponse>(
    url + '/staking/estimate-apr',
    {
      params: {
        amount: amountToStake,
        chain_id: networkVersion === Network.Testnet ? 43113 : 43114
      }
    }
  )

  return response.apr
}

export async function getStakingAPRHistory(
  networkVersion: Network,
  appVersion: AppVersion
) {
  const url = ArrowApiUrls[appVersion][networkVersion]

  const { data: response } = await GET<APRHistoryResponse>(
    url + '/staking/apr-history',
    {
      params: {
        chain_id: networkVersion === Network.Testnet ? 43113 : 43114
      }
    }
  )

  // Transforming the response into ChartData format
  const chartData = response.timestamps.map((timestamp, index) => ({
    x: timestamp,
    y: response.aprs[index]
  }))

  return chartData
}
