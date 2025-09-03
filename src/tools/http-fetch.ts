/**
 * HTTP Fetch Tool Adapter
 * Handles safe HTTP requests with allowlist and limits
 */

import { httpClient, generateCorrelationId } from '../runtime/http'
import { cachedHttpFetch } from '../runtime/cache'

export interface HttpFetchParams {
  url: string
  method?: 'GET' | 'HEAD'
  timeout?: number
  maxSize?: number // Max response size in bytes
}

// Allowlist of domains that can be fetched
const ALLOWED_DOMAINS = [
  'linkedin.com',
  'company.com',
  'acme.com',
  'example.com',
  'test.com'
]

// Default limits
const DEFAULT_TIMEOUT = 10000 // 10 seconds
const DEFAULT_MAX_SIZE = 1024 * 1024 // 1MB

export class HttpFetchTool {
  /**
   * Check if a URL is allowed
   */
  private isUrlAllowed(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return ALLOWED_DOMAINS.some(domain => urlObj.hostname.endsWith(domain))
    } catch {
      return false
    }
  }

  /**
   * Perform a safe HTTP GET request
   */
  async get(params: HttpFetchParams): Promise<any> {
    const { url, timeout = DEFAULT_TIMEOUT, maxSize = DEFAULT_MAX_SIZE } = params

    // Validate URL
    if (!url) {
      throw new Error('URL parameter is required')
    }

    if (!this.isUrlAllowed(url)) {
      throw new Error(`URL not allowed: ${url}`)
    }

    // Use cached HTTP fetch with correlation ID
    return cachedHttpFetch(async () => {
      const correlationId = generateCorrelationId()
      const response = await httpClient.get(url, {
        timeout,
        maxContentLength: maxSize,
        maxBodyLength: maxSize,
        headers: {
          'User-Agent': '4Runr-Gateway/1.0'
        },
        context: {
          correlationId,
          tool: 'http_fetch',
          action: 'get'
        }
      })

      // Return sanitized response
      return {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': response.headers['content-type'],
          'content-length': response.headers['content-length']
        },
        data: response.data,
        url: response.config.url
      }
    }, url, { method: 'GET', timeout, maxSize })
  }

  /**
   * Perform a safe HTTP HEAD request
   */
  async head(params: HttpFetchParams): Promise<any> {
    const { url, timeout = DEFAULT_TIMEOUT } = params

    // Validate URL
    if (!url) {
      throw new Error('URL parameter is required')
    }

    if (!this.isUrlAllowed(url)) {
      throw new Error(`URL not allowed: ${url}`)
    }

    const correlationId = generateCorrelationId()
    const response = await httpClient.head(url, {
      timeout,
      headers: {
        'User-Agent': '4Runr-Gateway/1.0'
      },
      context: {
        correlationId,
        tool: 'http_fetch',
        action: 'head'
      }
    })

    // Return sanitized response
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: response.config.url
    }
  }
}

export const httpFetchTool = new HttpFetchTool()
