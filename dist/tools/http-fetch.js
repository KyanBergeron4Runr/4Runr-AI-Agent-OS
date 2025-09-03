"use strict";
/**
 * HTTP Fetch Tool Adapter
 * Handles safe HTTP requests with allowlist and limits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpFetchTool = exports.HttpFetchTool = void 0;
const http_1 = require("../runtime/http");
const cache_1 = require("../runtime/cache");
// Allowlist of domains that can be fetched
const ALLOWED_DOMAINS = [
    'linkedin.com',
    'company.com',
    'acme.com',
    'example.com',
    'test.com'
];
// Default limits
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_SIZE = 1024 * 1024; // 1MB
class HttpFetchTool {
    /**
     * Check if a URL is allowed
     */
    isUrlAllowed(url) {
        try {
            const urlObj = new URL(url);
            return ALLOWED_DOMAINS.some(domain => urlObj.hostname.endsWith(domain));
        }
        catch {
            return false;
        }
    }
    /**
     * Perform a safe HTTP GET request
     */
    async get(params) {
        const { url, timeout = DEFAULT_TIMEOUT, maxSize = DEFAULT_MAX_SIZE } = params;
        // Validate URL
        if (!url) {
            throw new Error('URL parameter is required');
        }
        if (!this.isUrlAllowed(url)) {
            throw new Error(`URL not allowed: ${url}`);
        }
        // Use cached HTTP fetch with correlation ID
        return (0, cache_1.cachedHttpFetch)(async () => {
            const correlationId = (0, http_1.generateCorrelationId)();
            const response = await http_1.httpClient.get(url, {
                timeout,
                maxContentLength: maxSize,
                maxBodyLength: maxSize,
                headers: {
                    'User-Agent': '4Runr-Gateway/1.0'
                },
                context: {
                    correlationId,
                    tool: 'http_fetch',
                    action: 'get'
                }
            });
            // Return sanitized response
            return {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    'content-type': response.headers['content-type'],
                    'content-length': response.headers['content-length']
                },
                data: response.data,
                url: response.config.url
            };
        }, url, { method: 'GET', timeout, maxSize });
    }
    /**
     * Perform a safe HTTP HEAD request
     */
    async head(params) {
        const { url, timeout = DEFAULT_TIMEOUT } = params;
        // Validate URL
        if (!url) {
            throw new Error('URL parameter is required');
        }
        if (!this.isUrlAllowed(url)) {
            throw new Error(`URL not allowed: ${url}`);
        }
        const correlationId = (0, http_1.generateCorrelationId)();
        const response = await http_1.httpClient.head(url, {
            timeout,
            headers: {
                'User-Agent': '4Runr-Gateway/1.0'
            },
            context: {
                correlationId,
                tool: 'http_fetch',
                action: 'head'
            }
        });
        // Return sanitized response
        return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            url: response.config.url
        };
    }
}
exports.HttpFetchTool = HttpFetchTool;
exports.httpFetchTool = new HttpFetchTool();
//# sourceMappingURL=http-fetch.js.map