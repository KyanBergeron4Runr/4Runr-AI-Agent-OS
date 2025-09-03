import { z } from 'zod'

// SerpAPI parameter validation
export const SerpApiSearchSchema = z.object({
  query: z.string().min(1).max(500),
  location: z.string().optional(),
  num: z.number().min(1).max(100).optional().default(10),
  start: z.number().min(0).optional().default(0),
  safe: z.enum(['active', 'off']).optional().default('active'),
  intent: z.string().optional()
})

// HTTP Fetch parameter validation
export const HttpFetchGetSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().min(1000).max(30000).optional().default(10000),
  intent: z.string().optional()
})

export const HttpFetchHeadSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().min(1000).max(30000).optional().default(10000),
  intent: z.string().optional()
})

// OpenAI parameter validation
export const OpenAIChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1).max(4000)
  })).min(1).max(50),
  model: z.string().default('gpt-3.5-turbo'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().min(1).max(4000).optional().default(1000),
  intent: z.string().optional()
})

export const OpenAICompleteSchema = z.object({
  prompt: z.string().min(1).max(4000),
  model: z.string().default('text-davinci-003'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().min(1).max(4000).optional().default(1000),
  intent: z.string().optional()
})

// Gmail parameter validation
export const GmailSendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  from: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  intent: z.string().optional()
})

export const GmailProfileSchema = z.object({
  intent: z.string().optional()
})

// Tool-specific validator mapping
export const toolValidators: Record<string, Record<string, z.ZodSchema>> = {
  serpapi: {
    search: SerpApiSearchSchema
  },
  http_fetch: {
    get: HttpFetchGetSchema,
    head: HttpFetchHeadSchema
  },
  openai: {
    chat: OpenAIChatSchema,
    complete: OpenAICompleteSchema
  },
  gmail_send: {
    send: GmailSendSchema,
    profile: GmailProfileSchema
  }
}

// Validate tool parameters
export function validateToolParameters(tool: string, action: string, params: any): { valid: boolean; errors?: string[] } {
  const validator = toolValidators[tool]?.[action]
  
  if (!validator) {
    return { valid: false, errors: [`No validator found for ${tool}:${action}`] }
  }

  try {
    validator.parse(params)
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }
    }
    return { valid: false, errors: ['Unknown validation error'] }
  }
}

// Sanitize parameters (remove sensitive fields)
export function sanitizeParameters(tool: string, action: string, params: any): any {
  const sanitized = { ...params }
  
  // Remove sensitive fields based on tool
  if (tool === 'gmail_send' && action === 'send') {
    delete sanitized.body // Email body might contain sensitive content
  }
  
  if (tool === 'openai') {
    // Truncate messages/content for logging
    if (sanitized.messages) {
      sanitized.messages = sanitized.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content
      }))
    }
    if (sanitized.prompt) {
      sanitized.prompt = sanitized.prompt.length > 100 ? sanitized.prompt.substring(0, 100) + '...' : sanitized.prompt
    }
  }
  
  return sanitized
}
