import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { isUrlAllowedForFetch } from './securityHelpers';
import { validateInboundMediaUrl } from './validateMediaUrl';
import { resolvePublicAppBaseUrl } from './publicBaseUrl';

function isAllowedMediaDownloadUrl(url: string): boolean {
  const check = validateInboundMediaUrl(url);
  if (check.ok) return true;

  if (url.includes('/api/media/file/')) {
    const publicBase = resolvePublicAppBaseUrl();
    if (publicBase) {
      try {
        return new URL(url).origin === new URL(publicBase).origin;
      } catch {
        return false;
      }
    }
  }

  return isUrlAllowedForFetch(url);
}

export async function safeHttpGet<T = ArrayBuffer>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  if (!isAllowedMediaDownloadUrl(url)) {
    throw new Error('URL de download não permitida');
  }
  return axios.get<T>(url, { ...config, maxRedirects: 0 });
}
