/**
 * 4Runr Gateway Client SDK
 * Minimal client used by agents to talk to Gateway
 */

export interface TokenOptions {
  tools: string[]
  permissions: string[]
  ttlMinutes: number
}

export interface ProxyResponse {
  success: boolean
  data: any
  metadata: {
    agent_id: string
    agent_name: string
    tool: string
    action: string
    response_time_ms: number
  }
}

export class GatewayClient {
  constructor(
    private baseUrl: string,
    private agentId: string,
    private agentPrivateKeyPem: string
  ) {}

  /**
   * Get a new token from the Gateway
   */
  async getToken(opts: TokenOptions): Promise<string> {
    const expires_at = new Date(Date.now() + opts.ttlMinutes * 60_000).toISOString()
    
    const res = await fetch(`${this.baseUrl}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: this.agentId,
        tools: opts.tools,
        permissions: opts.permissions,
        expires_at
      })
    })
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({})) as any
      throw new Error(`Token generation failed: ${res.status} ${error.error || ''}`)
    }
    
    const { agent_token } = await res.json() as any
    return agent_token
  }

  /**
   * Make a proxied request through the Gateway
   */
  async proxy(
    tool: string, 
    action: string, 
    params: any, 
    agentToken: string, 
    tokenId?: string, 
    proofPayload?: string
  ): Promise<ProxyResponse> {
    const body: any = { 
      agent_token: agentToken, 
      tool, 
      action, 
      params 
    }

    // Add token provenance if provided
    if (tokenId && proofPayload) {
      body.token_id = tokenId
      body.proof_payload = proofPayload
    }

    const res = await fetch(`${this.baseUrl}/api/proxy-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    
    // Handle rate limiting
    if (res.status === 429) {
      const error = await res.json().catch(() => ({})) as any
      throw new Error(`Rate limit exceeded: ${error.retry_after || 'unknown'} seconds`)
    }
    
    // Handle other errors
    if (!res.ok) {
      const error = await res.json().catch(() => ({})) as any
      throw new Error(`Proxy request failed: ${res.status} ${error.error || ''}`)
    }
    
    // Check for token rotation recommendation
    const rotationRecommended = res.headers.get('X-Token-Rotation-Recommended')
    const tokenExpiresAt = res.headers.get('X-Token-Expires-At')
    
    if (rotationRecommended === 'true') {
      console.warn(`Token rotation recommended! Expires: ${tokenExpiresAt}`)
    }
    
    return res.json() as Promise<ProxyResponse>
  }

  /**
   * Convenience method for making a request with automatic token management
   */
  async requestWithToken(
    tool: string, 
    action: string, 
    params: any, 
    tokenOptions: TokenOptions
  ): Promise<ProxyResponse> {
    const token = await this.getToken(tokenOptions)
    return this.proxy(tool, action, params, token)
  }

  /**
   * Check if a token is expiring soon (within 5 minutes)
   */
  isTokenExpiringSoon(expiresAt: string): boolean {
    const timeLeft = new Date(expiresAt).getTime() - Date.now()
    return timeLeft < 5 * 60 * 1000 // 5 minutes
  }
}
