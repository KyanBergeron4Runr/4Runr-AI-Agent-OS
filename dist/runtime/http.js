"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpClient = exports.HardenedHttpClient = void 0;
exports.generateCorrelationId = generateCorrelationId;
exports.getRequestContext = getRequestContext;
exports.getRequestDuration = getRequestDuration;
const axios_1 = __importDefault(require("axios"));
const perf_hooks_1 = require("perf_hooks");
class HardenedHttpClient {
    constructor(config) {
        this.config = config;
        this.client = axios_1.default.create({
            timeout: config.timeoutMs,
            maxRedirects: config.maxRedirects,
            maxBodyLength: config.maxBodySize,
            maxContentLength: config.maxBodySize,
            headers: {
                'User-Agent': '4Runr-Gateway/1.0.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use((config) => {
            const context = config.metadata?.context;
            if (context?.correlationId) {
                config.headers = config.headers || {};
                config.headers['X-Correlation-Id'] = context.correlationId;
            }
            // Add performance timing
            config.metadata = {
                ...config.metadata,
                startTime: perf_hooks_1.performance.now()
            };
            return config;
        }, (error) => {
            return Promise.reject(error);
        });
        // Response interceptor
        this.client.interceptors.response.use((response) => {
            const startTime = response.config.metadata?.startTime;
            if (startTime) {
                const duration = perf_hooks_1.performance.now() - startTime;
                response.config.metadata = {
                    ...response.config.metadata,
                    duration
                };
            }
            return response;
        }, (error) => {
            const startTime = error.config?.metadata?.startTime;
            if (startTime) {
                const duration = perf_hooks_1.performance.now() - startTime;
                error.config.metadata = {
                    ...error.config.metadata,
                    duration
                };
            }
            return Promise.reject(error);
        });
    }
    async request(config) {
        return this.client.request(config);
    }
    async get(url, config) {
        return this.client.get(url, config);
    }
    async head(url, config) {
        return this.client.head(url, config);
    }
    async post(url, data, config) {
        return this.client.post(url, data, config);
    }
    async put(url, data, config) {
        return this.client.put(url, data, config);
    }
    async delete(url, config) {
        return this.client.delete(url, config);
    }
    async patch(url, data, config) {
        return this.client.patch(url, data, config);
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.HardenedHttpClient = HardenedHttpClient;
// Global HTTP client instance
const httpTimeoutMs = parseInt(process.env.HTTP_TIMEOUT_MS || '30000');
const httpKeepAlive = process.env.HTTP_KEEPALIVE !== 'false';
const httpMaxRedirects = parseInt(process.env.HTTP_MAX_REDIRECTS || '5');
const httpMaxBodySize = parseInt(process.env.HTTP_MAX_BODY_SIZE || '1048576'); // 1MB
exports.httpClient = new HardenedHttpClient({
    timeoutMs: httpTimeoutMs,
    keepAlive: httpKeepAlive,
    maxRedirects: httpMaxRedirects,
    maxBodySize: httpMaxBodySize
});
// Utility function to generate correlation IDs
function generateCorrelationId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
// Utility functions to extract metadata from responses
function getRequestContext(response) {
    return response.config.metadata?.context;
}
function getRequestDuration(response) {
    return response.config.metadata?.duration;
}
//# sourceMappingURL=http.js.map