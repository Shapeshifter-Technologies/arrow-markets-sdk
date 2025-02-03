import { ethers } from 'ethers'
import { Network } from '../common/types/general'
import { AppVersion } from './general'

export type AppVersionContractAddressMap = Record<
  AppVersion,
  Partial<Record<Network, string>>
>

export const ArrowRouterAddresses: AppVersionContractAddressMap = {
  [AppVersion.TESTNET]: {
    [Network.Testnet]: '0x0cA3464F1385aDa4622C72f6e598741EE63e22eB'
  },
  [AppVersion.COMPETITION]: {
    [Network.Testnet]: '0x10849924753dFCd92c66434cde0b3d0E8aB12310'
  },
  [AppVersion.MAINNET]: {
    [Network.Mainnet]: '0xC33867F01E320bB077415cD3592E6B3879AaC45d'
  }
}

export const ArrowStakingAddresses: AppVersionContractAddressMap = {
  [AppVersion.TESTNET]: {
    [Network.Testnet]: '0x6a678d61c81fa2fa39767a1374c709bccd9a9a98'
  },
  [AppVersion.COMPETITION]: {
    [Network.Testnet]: ''
  },
  [AppVersion.MAINNET]: {
    [Network.Mainnet]: '0x9193957DC6d298a83afdA45A83C24c6C397b135f'
  }
}

export const ArrowTokenAddresses: AppVersionContractAddressMap = {
  [AppVersion.TESTNET]: {
    [Network.Testnet]: '0x1922c40906014117E96e33387290b4574091080a'
  },
  [AppVersion.COMPETITION]: {
    [Network.Testnet]: ''
  },
  [AppVersion.MAINNET]: {
    [Network.Mainnet]: '0x5c5e384Bd4e36724B2562cCAA582aFd125277C9B'
  }
}

export const ChainIds: Record<Network, number> = {
  [Network.Testnet]: 43113,
  [Network.Mainnet]: 43114
}

// Providers
export const providers: any = {
  [Network.Testnet]: new ethers.providers.JsonRpcProvider(
    'https://api.avax-test.network/ext/bc/C/rpc'
  ),
  [Network.Mainnet]: new ethers.providers.JsonRpcProvider(
    'https://api.avax.network/ext/bc/C/rpc'
  )
}

export interface PollingOptions {
  interval: number
  blocksToWait: number
}
