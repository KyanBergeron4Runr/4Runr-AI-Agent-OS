import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { performance } from 'perf_hooks'

// Extend AxiosRequestConfig to include metadata
// Type augmentation for Axios to support metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      context?: RequestContext
      startTime?: number
      duration?: number
    }
  }
  
  interface InternalAxiosRequestConfig {
    metadata?: {
      context?: RequestContext
      startTime?: number
      duration?: number
    }
  }
}

export interface HttpClientConfig {
  timeoutMs: number
  keepAlive: boolean
  maxRedirects: number
  maxBodySize: number
}

export interface RequestContext {
  correlationId: string
  agentId?: string
  tool?: string
  action?: string
}

export class HardenedHttpClient {
  private client: AxiosInstance
  private config: HttpClientConfig

  constructor(config: HttpClientConfig) {
    this.config = config
    
    this.client = axios.create({
      timeout: config.timeoutMs,
      maxRedirects: config.maxRedirects,
      maxBodyLength: config.maxBodySize,
      maxContentLength: config.maxBodySize,
      headers: {
        'User-Agent': '4Runr-Gateway/1.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const context = config.metadata?.context
        if (context?.correlationId) {
          config.headers = config.headers || {}
          config.headers['X-Correlation-Id'] = context.correlationId
        }
        
        // Add performance timing
        config.metadata = {
          ...config.metadata,
          startTime: performance.now()
        }
        
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const startTime = response.config.metadata?.startTime
        if (startTime) {
          const duration = performance.now() - startTime
          response.config.metadata = {
            ...response.config.metadata,
            duration
          }
        }
        return response
      },
      (error) => {
        const startTime = error.config?.metadata?.startTime
        if (startTime) {
          const duration = performance.now() - startTime
          error.config.metadata = {
            ...error.config.metadata,
            duration
          }
        }
        return Promise.reject(error)
      }
    )
  }

  async request<T = any>(config: AxiosRequestConfig & { context?: RequestContext }): Promise<AxiosResponse<T>> {
    return this.client.request(config)
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig & { context?: RequestContext }): Promise<AxiosResponse<T>> {
    return this.client.get(url, config)
  }

  async head<T = any>(url: string, config?: AxiosRequestConfig & { context?: RequestContext }): Promise<AxiosResponse<T>> {
    return this.client.head(url, config)
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig & { context?: RequestContext }): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config)
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig & { context?: RequestContext }): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config)
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig & { context?: RequestContext }): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config)
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig & { context?: RequestContext }): Promise<AxiosResponse<T>> {
    return this.client.patch(url, data, config)
  }

  getConfig(): HttpClientConfig {
    return { ...this.config }
  }
}

// Global HTTP client instance
const httpTimeoutMs = parseInt(process.env.HTTP_TIMEOUT_MS || '30000')
const httpKeepAlive = process.env.HTTP_KEEPALIVE !== 'false'
const httpMaxRedirects = parseInt(process.env.HTTP_MAX_REDIRECTS || '5')
const httpMaxBodySize = parseInt(process.env.HTTP_MAX_BODY_SIZE || '1048576') // 1MB

export const httpClient = new HardenedHttpClient({
  timeoutMs: httpTimeoutMs,
  keepAlive: httpKeepAlive,
  maxRedirects: httpMaxRedirects,
  maxBodySize: httpMaxBodySize
})

// Utility function to generate correlation IDs
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Utility functions to extract metadata from responses
export function getRequestContext(response: AxiosResponse): RequestContext | undefined {
  return (response.config as any).metadata?.context
}

export function getRequestDuration(response: AxiosResponse): number | undefined {
  return (response.config as any).metadata?.duration
}
