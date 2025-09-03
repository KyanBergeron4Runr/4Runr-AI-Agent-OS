const upstreamMode = (process.env.UPSTREAM_MODE || 'live').toLowerCase()

// live adapters
import { serpApiTool } from './serpapi'
import { httpFetchTool } from './http-fetch'
import { openaiTool } from './openai'
import { gmailSendTool } from './gmail-send'

// mock adapters
import * as serpapiMock from './mock/serpapi.mock'
import * as httpFetchMock from './mock/http_fetch.mock'
import * as openaiMock from './mock/openai.mock'
import * as gmailSendMock from './mock/gmail_send.mock'

// Chaos injection function for mocks
function maybeChaos() {
  if ((process.env.FF_CHAOS || 'off') === 'on') {
    if (Math.random() < 0.2) { // 20% fail
      const ms = 300 + Math.random() * 1200
      return new Promise((_, rej) => setTimeout(() => rej(new Error('mock 503')), ms))
    }
  }
}

// Create mock tool objects that match the live tool interfaces
const serpapiMockTool = {
  search: async (params: any) => {
    await maybeChaos()
    return serpapiMock.search(params)
  },
  isConfigured: async () => true
}

const httpFetchMockTool = {
  get: async (params: any) => {
    await maybeChaos()
    return httpFetchMock.get(params)
  },
  head: async (params: any) => {
    await maybeChaos()
    return {
      url: params.url,
      status: 200,
      headers: { 'content-type': 'text/html' },
      bytes: 120
    }
  },
  isConfigured: async () => true
}

const openaiMockTool = {
  chat: async (params: any) => {
    await maybeChaos()
    return openaiMock.chat(params)
  },
  complete: async (params: any) => {
    await maybeChaos()
    return {
      model: params.model,
      output: `COMPLETION: ${params.prompt.slice(0, 100)}...`,
      tokens_est: Math.ceil(params.prompt.length / 3)
    }
  },
  isConfigured: async () => true
}

const gmailSendMockTool = {
  send: async (params: any) => {
    await maybeChaos()
    return gmailSendMock.send(params)
  },
  getProfile: async () => {
    await maybeChaos()
    return {
      email: 'mock@example.com',
      name: 'Mock User',
      status: 'active'
    }
  },
  isConfigured: async () => true
}

const use = upstreamMode === 'mock' ? {
  serpapi: serpapiMockTool,
  http_fetch: httpFetchMockTool,
  openai: openaiMockTool,
  gmail_send: gmailSendMockTool
} : {
  serpapi: serpApiTool,
  http_fetch: httpFetchTool,
  openai: openaiTool,
  gmail_send: gmailSendTool
}

export const routes: Record<string, Record<string, (params: any) => Promise<any>>> = {
  serpapi: { search: use.serpapi.search },
  http_fetch: { 
    get: use.http_fetch.get,
    head: use.http_fetch.head
  },
  openai: { 
    chat: use.openai.chat,
    complete: use.openai.complete
  },
  gmail_send: { 
    send: use.gmail_send.send,
    profile: use.gmail_send.getProfile
  }
}

// Export the mode for logging/debugging
export const currentMode = upstreamMode
export { use }
