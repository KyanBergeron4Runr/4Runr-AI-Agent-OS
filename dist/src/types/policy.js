"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TIMEZONE = exports.PolicySpecSchema = void 0;
exports.generateQuotaKey = generateQuotaKey;
const zod_1 = require("zod");
// Policy specification schema
exports.PolicySpecSchema = zod_1.z.object({
    scopes: zod_1.z.array(zod_1.z.string()).min(1), // e.g., ["serpapi:search", "http_fetch:get"]
    intent: zod_1.z.string().optional(), // e.g., "data_collection", "communication"
    guards: zod_1.z.object({
        maxRequestSize: zod_1.z.number().optional(), // bytes
        maxResponseSize: zod_1.z.number().optional(), // bytes
        allowedDomains: zod_1.z.array(zod_1.z.string()).optional(), // for http_fetch
        blockedDomains: zod_1.z.array(zod_1.z.string()).optional(),
        piiFilters: zod_1.z.array(zod_1.z.string()).optional(), // e.g., ["email", "phone", "ssn"]
        timeWindow: zod_1.z.object({
            start: zod_1.z.string().optional(), // HH:MM
            end: zod_1.z.string().optional(), // HH:MM
            timezone: zod_1.z.string().optional() // e.g., "America/New_York"
        }).optional()
    }).optional(),
    quotas: zod_1.z.array(zod_1.z.object({
        action: zod_1.z.string(), // e.g., "serpapi:search"
        limit: zod_1.z.number(),
        window: zod_1.z.string(), // e.g., "1h", "24h", "7d"
        resetStrategy: zod_1.z.enum(["sliding", "fixed"]).default("sliding")
    })).optional(),
    schedule: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        timezone: zod_1.z.string().default("UTC"),
        allowedDays: zod_1.z.array(zod_1.z.number()).optional(), // 0-6 (Sunday-Saturday)
        allowedHours: zod_1.z.object({
            start: zod_1.z.number().min(0).max(23).optional(),
            end: zod_1.z.number().min(0).max(23).optional()
        }).optional()
    }).optional(),
    responseFilters: zod_1.z.object({
        redactFields: zod_1.z.array(zod_1.z.string()).optional(), // e.g., ["api_key", "password"]
        truncateFields: zod_1.z.array(zod_1.z.object({
            field: zod_1.z.string(),
            maxLength: zod_1.z.number()
        })).optional(),
        blockPatterns: zod_1.z.array(zod_1.z.string()).optional() // regex patterns
    }).optional()
});
// Quota key generation
function generateQuotaKey(action, window) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    if (window === '1h') {
        const hour = now.getHours();
        return `${action}:${dateStr}:${hour}`;
    }
    else if (window === '24h') {
        return `${action}:${dateStr}`;
    }
    else if (window === '7d') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        const weekStr = weekStart.toISOString().split('T')[0];
        return `${action}:week:${weekStr}`;
    }
    return `${action}:${dateStr}`;
}
// Default timezone for policy evaluation
exports.DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC';
//# sourceMappingURL=policy.js.map