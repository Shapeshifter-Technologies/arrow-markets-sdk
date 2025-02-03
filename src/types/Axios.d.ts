import type {
  AxiosRequestConfig,
  AxiosResponse as AxiosResponseObject
} from 'axios'

export type AxiosRequest<A> = Omit<AxiosRequestConfig, 'params'> & {
  params?: A
}
export type AxiosResponse<B> = Promise<
  Omit<AxiosResponseObject, 'data'> & { data: B }
>

export interface AxiosError {
  code: number
  description: string
  name: string
}
