import type { PortfolioData } from '../types/Get'
import type { AppVersion } from '../types/general'
import { ArrowApiUrls } from '../types/api'
import { ChainIds } from '../types/web3'
import type { Network } from '../common/types/general'
import type { Ticker } from '../common/types/option'
import { ContractType, OrderType } from '../common/types/option'
import {
  determinePositionStrategyType,
  convertToGeneralPositionType
} from '../common/utils/parsing'
import { getTimeUTC } from '../common/utils/time'
import { getSingleAtomPayoff } from './pricing'
import { determinePositionOrderType, getLongFormStrategyType } from './parsing'
import { GET } from './axios'

export async function getUserPortfolio(
  userAddress: string,
  networkVersion: Network,
  appVersion: AppVersion,
  page = 1,
  limit = 1000
): Promise<any> {
  const apiUrl = ArrowApiUrls[appVersion][networkVersion]
  const chainId = ChainIds[networkVersion]
  const userPortfolioResponse = await GET<PortfolioData>(
    apiUrl + '/user/portfolio',
    {
      params: {
        address: userAddress,
        page: page,
        limit: limit,
        chain_id: chainId
      }
    }
  )

  const openPositions = await getOpenPositions(userPortfolioResponse.data)

  return openPositions
}

async function getOpenPositions(portfolioData: PortfolioData) {
  const parsedOpenPositions: any[] = []
  const parsedTransactionHistory: any[] = []

  portfolioData.open_positions.map(position => {
    const optionLegs = position.options.map(option => ({
      ticker: position.ticker.split('-')[0] as Ticker,
      contractType:
        option.contract_type === 0 || option.contract_type === 'C'
          ? ContractType.CALL
          : ContractType.PUT,
      orderType:
        option.side === 'Buy' ? OrderType.OPEN_LONG : OrderType.OPEN_SHORT,
      strike: option.strike,
      readableExpiration: getTimeUTC(
        (Number(position.expiration) / 10 ** 9) * 1000
      ).readableTimestamp,
      expirationTimestamp: (Number(position.expiration) / 10 ** 9) * 1000,
      quantity: position.quantity,
      positionId: position.position_id,
      greeks: null,
      price: null
    }))

    const positionStrategy = determinePositionStrategyType(optionLegs)
    const orderType = determinePositionOrderType(positionStrategy)
    const parsedPosition = {
      averageExecutionPrice: position.average_position_price,
      contractAddress: position.transaction_hash,
      currentPrice: undefined,
      expiration: (Number(position.expiration) / 10 ** 9) * 1000,
      greeks: {
        delta: 0,
        gamma: 0,
        rho: 0,
        theta: 0,
        vega: 0
      },
      positionId: position.position_id,
      optionLegs: optionLegs,
      orderType: orderType,
      ratio: Number(Math.abs(position.quantity).toFixed(2)),
      status: 'idle',
      strategyType: convertToGeneralPositionType(positionStrategy),
      ticker: position.ticker.split('-')[0],
      symbol: position.ticker
    }
    parsedOpenPositions.push(parsedPosition)
  })

  const parsedExpiredPositions = await Promise.all(
    portfolioData.expired_positions.map(async position => {
      const optionLegs = position.options.map(option => ({
        ticker: position.ticker.split('-')[0] as Ticker,
        contractType:
          option.contract_type === 0 || option.contract_type === 'C'
            ? ContractType.CALL
            : ContractType.PUT,
        orderType:
          option.side === 'Buy' ? OrderType.OPEN_LONG : OrderType.OPEN_SHORT,
        strike: option.strike,
        readableExpiration: getTimeUTC(
          (Number(position.expiration) / 10 ** 9) * 1000
        ).readableTimestamp,
        expirationTimestamp: (Number(position.expiration) / 10 ** 9) * 1000,
        quantity: position.quantity,
        greeks: null,
        price: null
      }))

      const positionStrategy = determinePositionStrategyType(optionLegs)
      const generalPositionType = convertToGeneralPositionType(positionStrategy)
      const orderType = determinePositionOrderType(positionStrategy)
      let strikeValues = optionLegs.map(optionLeg => optionLeg.strike)
      strikeValues =
        strikeValues.length === 1 ? [strikeValues[0], 0] : strikeValues

      let payOff = 0
      let settlementStatus = payOff > 0 ? 'Expired ITM' : 'Expired OTM'
      if (position.is_settled) {
        settlementStatus = 'Settled'
      } else {
        if (position.settlement_price) {
          payOff = getSingleAtomPayoff(
            generalPositionType,
            strikeValues,
            position.settlement_price,
            position.average_position_price!,
            position.quantity
          )
          settlementStatus = payOff > 0 ? 'Expired ITM' : 'Expired OTM'
        } else {
          settlementStatus = 'Chain Not Initialized'
        }
      }

      return {
        averageExecutionPrice: position.average_position_price,
        contractAddress: position.transaction_hash,
        currentPrice: undefined,
        expiration: (Number(position.expiration) / 10 ** 9) * 1000,
        greeks: {
          delta: 0,
          gamma: 0,
          rho: 0,
          theta: 0,
          vega: 0
        },
        tokenId: position.token_id,
        settlementPrice: position.settlement_price,
        settlementStatus: settlementStatus,
        optionLegs: optionLegs,
        orderType: orderType,
        positionId: position.position_id,
        ratio: Number(Math.abs(position.quantity).toFixed(2)),
        status: 'idle',
        symbol: position.ticker,
        payOff: payOff,
        strategyType: convertToGeneralPositionType(positionStrategy),
        ticker: position.ticker.split('-')[0]
      }
    })
  )

  portfolioData.transaction_history.map(transaction => {
    let orderType = OrderType.OPEN_LONG
    if (transaction.transaction_type === 'TRANSFER') {
      if (transaction.is_short) {
        orderType = OrderType.OPEN_SHORT
      } else {
        orderType = OrderType.OPEN_LONG
      }
    } else {
      if (transaction.is_short) {
        orderType =
          transaction.transaction_type === 'OPEN'
            ? OrderType.OPEN_SHORT
            : OrderType.CLOSE_SHORT
      } else {
        orderType =
          transaction.transaction_type === 'OPEN'
            ? OrderType.OPEN_LONG
            : OrderType.CLOSE_LONG
      }
    }

    const parsedPosition = {
      averageExecutionPrice: transaction.average_position_price,
      transactionHash: transaction.transaction_hash,
      currentPrice: undefined,
      expiration: (Number(transaction.expiration) / 10 ** 9) * 1000,
      greeks: {
        delta: 0,
        gamma: 0,
        rho: 0,
        theta: 0,
        vega: 0
      },
      executionPrice: transaction.execution_price,
      orderType: orderType,
      ratio: Number(Math.abs(transaction.quantity).toFixed(2)),
      status: 'idle',
      positionId: transaction.position_id,
      strategyType: getLongFormStrategyType(transaction.strategy_type),
      ticker: transaction.ticker.split('-')[0],
      symbol: transaction.ticker,
      transactionType: transaction.transaction_type,
      timestamp: Number(transaction.timestamp! / 1e6),
      transactionStatus: transaction.transaction_status,
      failureMessage: transaction.failure_message,
      orderId: transaction.rfe_id
    }
    parsedTransactionHistory.push(parsedPosition)
  })

  return {
    openPositions: parsedOpenPositions,
    expiredPositions: parsedExpiredPositions,
    transactionHistory: parsedTransactionHistory
  }
}
