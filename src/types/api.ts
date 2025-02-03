import { Network } from '../common/types/general'
import { AppVersion } from './general'

export type AppVersionApiUrlMap = Record<
  AppVersion,
  Partial<Record<Network, string>>
>

export const ArrowApiUrls: AppVersionApiUrlMap = {
  [AppVersion.TESTNET]: {
    [Network.Testnet]: 'https://api-rfq-testnet.prd.arrowmarkets.info'
  },
  [AppVersion.COMPETITION]: {
    [Network.Testnet]:
      'https://api-rfq-competition-testnet.prd.arrowmarkets.info'
  },
  [AppVersion.MAINNET]: {
    [Network.Mainnet]: 'https://api-rfq-testnet.prd.arrowmarkets.info'
  }
}
