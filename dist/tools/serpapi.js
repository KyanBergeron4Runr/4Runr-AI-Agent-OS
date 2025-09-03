"use strict";
/**
 * SerpAPI Tool Adapter
 * Handles search requests through SerpAPI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serpApiTool = exports.SerpApiTool = void 0;
const http_1 = require("../runtime/http");
const cache_1 = require("../runtime/cache");
const envelope_1 = require("../crypto/envelope");
const memory_db_1 = require("../models/memory-db");
class SerpApiTool {
    constructor() {
        // Don't throw error if not configured - let isConfigured() handle it
    }
    /**
     * Check if SerpAPI is configured
     */
    async isConfigured() {
        try {
            const credential = await memory_db_1.memoryDB.findActiveToolCredential('serpapi');
            if (!credential) {
                return false;
            }
            // Get the KEK from environment
            const kekBase64 = process.env.KEK_BASE64;
            if (!kekBase64) {
                return false;
            }
            const kek = Buffer.from(kekBase64, 'base64');
            // Decrypt the credential
            this.apiKey = (0, envelope_1.decryptString)(credential.encryptedCredential, kek);
            return true;
        }
        catch (error) {
            console.error('Error configuring SerpAPI tool:', error);
            return false;
        }
    }
    /**
     * Perform a search using SerpAPI
     */
    async search(params) {
        // Check if SerpAPI is configured
        if (!(await this.isConfigured())) {
            throw new Error('SerpAPI not configured - no active credential found');
        }
        // Validate required parameters
        if (!params.q) {
            throw new Error('Query parameter "q" is required');
        }
        // Set defaults
        const searchParams = {
            engine: 'google',
            num: 10,
            ...params,
            api_key: this.apiKey
        };
        // Use cached search with correlation ID
        return (0, cache_1.cachedSerpApiSearch)(async () => {
            const correlationId = (0, http_1.generateCorrelationId)();
            const response = await http_1.httpClient.get('https://serpapi.com/search', {
                params: searchParams,
                context: {
                    correlationId,
                    tool: 'serpapi',
                    action: 'search'
                }
            });
            return response.data;
        }, params);
    }
}
exports.SerpApiTool = SerpApiTool;
exports.serpApiTool = new SerpApiTool();
//# sourceMappingURL=serpapi.js.map