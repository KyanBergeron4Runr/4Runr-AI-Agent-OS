import fetch, { Headers, RequestInit, Response } from 'node-fetch'
import { createErrorFromResponse, GatewayError, GatewayTokenError } from './errors'
import { generateCorrelationId, extractCorrelationId } from './utils/correlation'
import { withRetry } from './utils/retry'
import { generateIdempotencyKey } from './utils/idempotency'

export interface GatewayClientOptions {
  baseUrl: string
  agentId: string
  agentPrivateKeyPem: string
  defaultIntent?: string
  timeoutMs?: number
}

export interface TokenOptions {
  tools: string[]
  permissions: string[]
  ttlMinutes: number
}

export interface TokenResponse {
  agent_token: string
}

export interface ProxyResponse<T = any> {
  success: boolean
  data: T
  metadata: {
    agent_id: string
    agent_name: string
    tool: string
    action: string
    response_time_ms: number
  }
}

export interface AsyncProxyResponse {
  job_id: string
}

export interface JobResponse {
  status: 'queued' | 'running' | 'done' | 'failed'
  result?: any
  error?: string
}

export class GatewayClient {
  private baseUrl: string
  private agentId: string
  private agentPrivateKeyPem: string
  private defaultIntent?: string
  private timeoutMs: number
  private currentIntent: string

  constructor(options: GatewayClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.agentId = options.agentId
    this.agentPrivateKeyPem = options.agentPrivateKeyPem
    this.defaultIntent = options.defaultIntent
    this.timeoutMs = options.timeoutMs || 6000
    this.currentIntent = options.defaultIntent || ''
  }

  /**
   * Set the current intent for requests
   */
  setIntent(intent: string): void {
    this.currentIntent = intent
  }

  /**
   * Get a new token from the Gateway
   */
  async getToken(opts: TokenOptions): Promise<string> {
    const expiresAt = new Date(Date.now() + opts.ttlMinutes * 60 * 1000).toISOString()
    
    const response = await this.makeRequest('/api/generate-token', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: this.agentId,
        tools: opts.tools,
        permissions: opts.permissions,
        expires_at: expiresAt
      })
    })

    const data = await response.json() as TokenResponse
    return data.agent_token
  }

  /**
   * Make a proxied request through the Gateway
   */
  async proxy<T = any>(
    tool: string,
    action: string,
    params: Record<string, any>,
    agentToken?: string,
    proofPayloadOverride?: object
  ): Promise<T> {
    // Auto-fetch token if not provided
    let token = agentToken
    if (!token) {
      token = await this.getToken({
        tools: [tool],
        permissions: ['read', 'write'],
        ttlMinutes: 10
      })
    }

    // Check token age (reject if older than 24h)
    if (token) {
      const tokenAge = this.getTokenAge(token)
      if (tokenAge > 24 * 60 * 60 * 1000) { // 24 hours
        throw new GatewayTokenError('Token is too old (older than 24h)')
      }
    }

    const body: any = {
      agent_token: token,
      tool,
      action,
      params
    }

    // Add intent if set
    if (this.currentIntent) {
      body.intent = this.currentIntent
    }

    // Add proof payload override if provided
    if (proofPayloadOverride) {
      body.proof_payload = JSON.stringify(proofPayloadOverride)
    }

    const response = await this.makeRequest('/api/proxy-request', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    const data = await response.json() as ProxyResponse<T>
    
    // Check for token rotation recommendation
    const rotationRecommended = response.headers.get('X-Token-Rotation-Recommended')
    const tokenExpiresAt = response.headers.get('X-Token-Expires-At')
    
    if (rotationRecommended === 'true') {
      console.warn(`Token rotation recommended! Expires: ${tokenExpiresAt}`)
    }

    return data.data
  }

  /**
   * Make an async proxy request
   */
  async proxyAsync(
    tool: string,
    action: string,
    params: Record<string, any>,
    agentToken?: string
  ): Promise<{ jobId: string }> {
    // Auto-fetch token if not provided
    let token = agentToken
    if (!token) {
      token = await this.getToken({
        tools: [tool],
        permissions: ['read', 'write'],
        ttlMinutes: 10
      })
    }

    const body: any = {
      agent_token: token,
      tool,
      action,
      params,
      async: true
    }

    // Add intent if set
    if (this.currentIntent) {
      body.intent = this.currentIntent
    }

    const response = await this.makeRequest('/api/proxy-request', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    const data = await response.json() as AsyncProxyResponse
    return { jobId: data.job_id }
  }

  /**
   * Get job status and result
   */
  async getJob(jobId: string): Promise<JobResponse> {
    const response = await this.makeRequest(`/api/jobs/${jobId}`, {
      method: 'GET'
    })

    return await response.json() as JobResponse
  }

  /**
   * Make an HTTP request with retry logic and error handling
   */
  private async makeRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const correlationId = generateCorrelationId()

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
        'User-Agent': '@4runr/gateway/1.0.0',
        ...options.headers
      },
      signal: AbortSignal.timeout(this.timeoutMs)
    }

    return withRetry(async () => {
      try {
        const response = await fetch(url, requestOptions)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
          const retryAfter = response.headers.get('Retry-After')
          
          throw createErrorFromResponse(
            response.status,
            errorData.error || `HTTP ${response.status}`,
            retryAfter || undefined
          )
        }

        return response
      } catch (error) {
        if (error instanceof GatewayError) {
          throw error
        }
        
        if (error instanceof Error) {
          throw new GatewayError(
            `Network error: ${error.message}`,
            undefined,
            'NETWORK_ERROR'
          )
        }
        
        throw error
      }
    })
  }

  /**
   * Get token age in milliseconds
   */
  private getTokenAge(token: string): number {
    try {
      // Extract timestamp from token (assuming it's in the format we expect)
      // This is a simplified implementation - in practice, you'd decode the JWT
      const parts = token.split('.')
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        if (payload.iat) {
          return Date.now() - (payload.iat * 1000)
        }
      }
    } catch {
      // If we can't parse the token, assume it's recent
    }
    return 0
  }

  /**
   * Mask sensitive parameters in logs
   */
  private maskParams(params: Record<string, any>): Record<string, any> {
    const masked = { ...params }
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'api_key']
    
    for (const key of sensitiveKeys) {
      if (masked[key]) {
        masked[key] = '***MASKED***'
      }
    }
    
    return masked
  }
}
