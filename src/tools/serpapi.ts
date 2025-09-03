/**
 * SerpAPI Tool Adapter
 * Handles search requests through SerpAPI
 */

import { httpClient, generateCorrelationId } from '../runtime/http'
import { cachedSerpApiSearch } from '../runtime/cache'
import { decryptString } from '../crypto/envelope'
import { memoryDB } from '../models/memory-db'

export interface SerpApiSearchParams {
  q: string
  engine?: string
  location?: string
  num?: number
  start?: number
  [key: string]: any
}

export class SerpApiTool {
  private apiKey?: string

  constructor() {
    // Don't throw error if not configured - let isConfigured() handle it
  }

  /**
   * Check if SerpAPI is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const credential = await memoryDB.findActiveToolCredential('serpapi')
      if (!credential) {
        return false
      }

      // Get the KEK from environment
      const kekBase64 = process.env.KEK_BASE64
      if (!kekBase64) {
        return false
      }
      const kek = Buffer.from(kekBase64, 'base64')

      // Decrypt the credential
      this.apiKey = decryptString(credential.encryptedCredential, kek)
      return true
    } catch (error) {
      console.error('Error configuring SerpAPI tool:', error)
      return false
    }
  }

  /**
   * Perform a search using SerpAPI
   */
  async search(params: SerpApiSearchParams): Promise<any> {
    // Check if SerpAPI is configured
    if (!(await this.isConfigured())) {
      throw new Error('SerpAPI not configured - no active credential found')
    }

    // Validate required parameters
    if (!params.q) {
      throw new Error('Query parameter "q" is required')
    }

    // Set defaults
    const searchParams = {
      engine: 'google',
      num: 10,
      ...params,
      api_key: this.apiKey
    }

    // Use cached search with correlation ID
    return cachedSerpApiSearch(async () => {
      const correlationId = generateCorrelationId()
      const response = await httpClient.get('https://serpapi.com/search', {
        params: searchParams,
        context: {
          correlationId,
          tool: 'serpapi',
          action: 'search'
        }
      })

      return response.data
    }, params)
  }
}

export const serpApiTool = new SerpApiTool()
