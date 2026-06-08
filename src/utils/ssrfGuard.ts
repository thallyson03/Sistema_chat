import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { isUrlAllowedForFetch } from './securityHelpers';

export async function safeHttpGet<T = ArrayBuffer>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  if (!isUrlAllowedForFetch(url)) {
    throw new Error('URL de download não permitida');
  }
  return axios.get<T>(url, config);
}
