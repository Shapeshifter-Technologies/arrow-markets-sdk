export interface OpenPosition {
  averageExecutionPrice: undefined
  contractAddress: string | null
  currentPrice: undefined
  expiration: string | null
  greeks: {
    delta: number
    gamma: number
    rho: number
    theta: number
    vega: number
  }
  optionLegs: {
    contract_type: number
    quantity: number
    strike: number
  }
  orderType: undefined // You didn't provide orderType in the input data
  ratio: number
  status: string
  strategyType: string
  ticker: string | null
}
