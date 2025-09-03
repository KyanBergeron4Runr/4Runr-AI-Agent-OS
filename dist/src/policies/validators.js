"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolValidators = exports.GmailProfileSchema = exports.GmailSendSchema = exports.OpenAICompleteSchema = exports.OpenAIChatSchema = exports.HttpFetchHeadSchema = exports.HttpFetchGetSchema = exports.SerpApiSearchSchema = void 0;
exports.validateToolParameters = validateToolParameters;
exports.sanitizeParameters = sanitizeParameters;
const zod_1 = require("zod");
// SerpAPI parameter validation
exports.SerpApiSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(500),
    location: zod_1.z.string().optional(),
    num: zod_1.z.number().min(1).max(100).optional().default(10),
    start: zod_1.z.number().min(0).optional().default(0),
    safe: zod_1.z.enum(['active', 'off']).optional().default('active'),
    intent: zod_1.z.string().optional()
});
// HTTP Fetch parameter validation
exports.HttpFetchGetSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    timeout: zod_1.z.number().min(1000).max(30000).optional().default(10000),
    intent: zod_1.z.string().optional()
});
exports.HttpFetchHeadSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    timeout: zod_1.z.number().min(1000).max(30000).optional().default(10000),
    intent: zod_1.z.string().optional()
});
// OpenAI parameter validation
exports.OpenAIChatSchema = zod_1.z.object({
    messages: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.enum(['system', 'user', 'assistant']),
        content: zod_1.z.string().min(1).max(4000)
    })).min(1).max(50),
    model: zod_1.z.string().default('gpt-3.5-turbo'),
    temperature: zod_1.z.number().min(0).max(2).optional().default(0.7),
    max_tokens: zod_1.z.number().min(1).max(4000).optional().default(1000),
    intent: zod_1.z.string().optional()
});
exports.OpenAICompleteSchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1).max(4000),
    model: zod_1.z.string().default('text-davinci-003'),
    temperature: zod_1.z.number().min(0).max(2).optional().default(0.7),
    max_tokens: zod_1.z.number().min(1).max(4000).optional().default(1000),
    intent: zod_1.z.string().optional()
});
// Gmail parameter validation
exports.GmailSendSchema = zod_1.z.object({
    to: zod_1.z.string().email(),
    subject: zod_1.z.string().min(1).max(200),
    body: zod_1.z.string().min(1).max(10000),
    from: zod_1.z.string().email().optional(),
    cc: zod_1.z.array(zod_1.z.string().email()).optional(),
    bcc: zod_1.z.array(zod_1.z.string().email()).optional(),
    intent: zod_1.z.string().optional()
});
exports.GmailProfileSchema = zod_1.z.object({
    intent: zod_1.z.string().optional()
});
// Tool-specific validator mapping
exports.toolValidators = {
    serpapi: {
        search: exports.SerpApiSearchSchema
    },
    http_fetch: {
        get: exports.HttpFetchGetSchema,
        head: exports.HttpFetchHeadSchema
    },
    openai: {
        chat: exports.OpenAIChatSchema,
        complete: exports.OpenAICompleteSchema
    },
    gmail_send: {
        send: exports.GmailSendSchema,
        profile: exports.GmailProfileSchema
    }
};
// Validate tool parameters
function validateToolParameters(tool, action, params) {
    const validator = exports.toolValidators[tool]?.[action];
    if (!validator) {
        return { valid: false, errors: [`No validator found for ${tool}:${action}`] };
    }
    try {
        validator.parse(params);
        return { valid: true };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                valid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            };
        }
        return { valid: false, errors: ['Unknown validation error'] };
    }
}
// Sanitize parameters (remove sensitive fields)
function sanitizeParameters(tool, action, params) {
    const sanitized = { ...params };
    // Remove sensitive fields based on tool
    if (tool === 'gmail_send' && action === 'send') {
        delete sanitized.body; // Email body might contain sensitive content
    }
    if (tool === 'openai') {
        // Truncate messages/content for logging
        if (sanitized.messages) {
            sanitized.messages = sanitized.messages.map((msg) => ({
                role: msg.role,
                content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content
            }));
        }
        if (sanitized.prompt) {
            sanitized.prompt = sanitized.prompt.length > 100 ? sanitized.prompt.substring(0, 100) + '...' : sanitized.prompt;
        }
    }
    return sanitized;
}
//# sourceMappingURL=validators.js.map