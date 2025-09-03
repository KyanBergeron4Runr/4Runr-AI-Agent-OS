import axios, { AxiosInstance } from 'axios'
import { 
  Agent, 
  Run, 
  SentinelSpan, 
  GuardEvent, 
  ApiResponse,
  logger 
} from '@4runr/shared'

export interface GatewayClientConfig {
  baseUrl: string
  agentId?: string
  timeout?: number
}

export class GatewayClient {
  private client: AxiosInstance
  private config: GatewayClientConfig

  constructor(config: GatewayClientConfig) {
    this.config = config
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add request/response interceptors
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Making request to: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        logger.error('Request error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Response received: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        logger.error('Response error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  // Health and status
  async health(): Promise<ApiResponse> {
    const response = await this.client.get('/health')
    return response.data
  }

  async ready(): Promise<ApiResponse> {
    const response = await this.client.get('/ready')
    return response.data
  }

  // Agent management
  async createAgent(agent: Partial<Agent>): Promise<ApiResponse<Agent>> {
    const response = await this.client.post('/api/agents', agent)
    return response.data
  }

  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    const response = await this.client.get(`/api/agents/${agentId}`)
    return response.data
  }

  async listAgents(): Promise<ApiResponse<Agent[]>> {
    const response = await this.client.get('/api/agents')
    return response.data
  }

  async startAgent(agentId: string): Promise<ApiResponse<Run>> {
    const response = await this.client.post(`/api/agents/${agentId}/start`)
    return response.data
  }

  // Sentinel system
  async getSentinelHealth(): Promise<ApiResponse> {
    const response = await this.client.get('/api/sentinel/health')
    return response.data
  }

  async getSentinelMetrics(): Promise<ApiResponse> {
    const response = await this.client.get('/api/sentinel/metrics')
    return response.data
  }

  async getSentinelConfig(): Promise<ApiResponse> {
    const response = await this.client.get('/api/sentinel/config')
    return response.data
  }

  async updateSentinelConfig(config: any): Promise<ApiResponse> {
    const response = await this.client.post('/api/sentinel/config', config)
    return response.data
  }

  // Coach system
  async getCoachReport(agentId: string, runCount?: number): Promise<ApiResponse> {
    const params = runCount ? { runCount } : {}
    const response = await this.client.get(`/api/coach/report/${agentId}`, { params })
    return response.data
  }

  async startCoachExperiment(agentId: string, patchProposal: any): Promise<ApiResponse> {
    const response = await this.client.post('/api/coach/experiment/start', {
      agentId,
      patchProposal
    })
    return response.data
  }

  // SSE event streaming
  createSSEConnection(runId: string): EventSource {
    return new EventSource(`${this.config.baseUrl}/api/runs/${runId}/guard/stream`)
  }

  // Diagnostics (development only)
  async emitDemoRun(agentId: string, input: any): Promise<ApiResponse> {
    const response = await this.client.post('/api/diagnostics/emit-demo-run', {
      agentId,
      input
    })
    return response.data
  }

  // Utility methods
  getBaseUrl(): string {
    return this.config.baseUrl
  }

  getAgentId(): string | undefined {
    return this.config.agentId
  }
}

// Export types
export type { 
  Agent, 
  Run, 
  SentinelSpan, 
  GuardEvent, 
  ApiResponse 
} from '@4runr/shared'

// Default export
export default GatewayClient
