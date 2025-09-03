/**
 * OpenAI Tool Adapter
 * Handles chat completions and other OpenAI API calls
 */

import axios from 'axios'
import { secretsProvider } from '../secrets/provider'
import { decryptString } from '../crypto/envelope'
import { memoryDB } from '../models/memory-db'

export interface OpenAIChatParams {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  max_tokens?: number
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

export class OpenAITool {
  private apiKey?: string
  private baseUrl: string

  constructor() {
    this.baseUrl = 'https://api.openai.com/v1'
  }

  /**
   * Check if OpenAI is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const credential = await memoryDB.findActiveToolCredential('openai')
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
      console.error('Error configuring OpenAI tool:', error)
      return false
    }
  }

  /**
   * Perform a chat completion
   */
  async chat(params: OpenAIChatParams): Promise<any> {
    // Check if OpenAI is configured
    if (!(await this.isConfigured())) {
      throw new Error('OpenAI not configured - no active credential found')
    }

    // Validate required parameters
    if (!params.model) {
      throw new Error('Model parameter is required')
    }
    if (!params.messages || !Array.isArray(params.messages) || params.messages.length === 0) {
      throw new Error('Messages array is required and must not be empty')
    }

    // Set defaults
    const chatParams = {
      temperature: 0.7,
      max_tokens: 1000,
      ...params
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        chatParams,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout for OpenAI
        }
      )

      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('OpenAI authentication failed - check API key')
      }
      if (error.response?.status === 429) {
        throw new Error('OpenAI rate limit exceeded')
      }
      if (error.response?.status === 400) {
        const errorData = error.response.data
        throw new Error(`OpenAI request error: ${errorData.error?.message || 'Bad request'}`)
      }
      throw new Error(`OpenAI request failed: ${error.message}`)
    }
  }

  /**
   * Simple text completion (legacy)
   */
  async complete(params: {
    model: string
    prompt: string
    max_tokens?: number
    temperature?: number
  }): Promise<any> {
    // Check if OpenAI is configured
    if (!(await this.isConfigured())) {
      throw new Error('OpenAI not configured - no active credential found')
    }

    const { model, prompt, max_tokens = 100, temperature = 0.7 } = params

    if (!model || !prompt) {
      throw new Error('Model and prompt are required')
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/completions`,
        {
          model,
          prompt,
          max_tokens,
          temperature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      )

      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('OpenAI authentication failed - check API key')
      }
      throw new Error(`OpenAI completion failed: ${error.message}`)
    }
  }
}

export const openaiTool = new OpenAITool()
