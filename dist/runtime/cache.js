"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = exports.LRUCache = void 0;
exports.generateSerpApiCacheKey = generateSerpApiCacheKey;
exports.generateHttpFetchCacheKey = generateHttpFetchCacheKey;
exports.getFromCache = getFromCache;
exports.setInCache = setInCache;
exports.isCacheEnabled = isCacheEnabled;
exports.cachedSerpApiSearch = cachedSerpApiSearch;
exports.cachedHttpFetch = cachedHttpFetch;
const metrics_1 = require("../observability/metrics");
class LRUCache {
    constructor(maxSize = 1000, defaultTtl = 60000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.defaultTtl = defaultTtl;
        this.stats = {
            hits: 0,
            misses: 0,
            size: 0,
            maxSize
        };
    }
    set(key, value, ttl) {
        const entry = {
            value,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTtl
        };
        // Remove if already exists
        if (this.cache.has(key)) {
            this.cache.delete(key);
            this.stats.size--;
        }
        // Evict if at capacity
        if (this.stats.size >= this.maxSize) {
            this.evictOldest();
        }
        this.cache.set(key, entry);
        this.stats.size++;
    }
    get(key, tool, action) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.stats.size--;
            this.stats.misses++;
            return null;
        }
        // Move to end (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.stats.hits++;
        // Record cache hit with tool/action context if available
        if (tool && action) {
            (0, metrics_1.recordCacheHit)(tool, action);
        }
        return entry.value;
    }
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.stats.size--;
            return false;
        }
        return true;
    }
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.size--;
        }
        return deleted;
    }
    clear() {
        this.cache.clear();
        this.stats.size = 0;
    }
    evictOldest() {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
            this.cache.delete(firstKey);
            this.stats.size--;
        }
    }
    getStats() {
        return { ...this.stats };
    }
    getHitRate() {
        const total = this.stats.hits + this.stats.misses;
        return total > 0 ? this.stats.hits / total : 0;
    }
}
exports.LRUCache = LRUCache;
// Cache configuration
const cacheEnabled = process.env.CACHE_ENABLED !== 'false';
const cacheTtlMs = parseInt(process.env.CACHE_TTL_MS || '60000'); // 1 minute
const cacheMaxSize = parseInt(process.env.CACHE_MAX_SIZE || '1000');
// Global cache instance
exports.cache = new LRUCache(cacheMaxSize, cacheTtlMs);
// Cache key generators
function generateSerpApiCacheKey(params) {
    const { q, engine, location, num } = params;
    return `serpapi:${JSON.stringify({ q, engine, location, num })}`;
}
function generateHttpFetchCacheKey(url, options) {
    const method = options?.method || 'GET';
    const headers = options?.headers ? JSON.stringify(options.headers) : '';
    return `http_fetch:${method}:${url}:${headers}`;
}
// Cache utilities
function getFromCache(key) {
    if (!cacheEnabled)
        return null;
    return exports.cache.get(key);
}
function setInCache(key, value, ttl) {
    if (!cacheEnabled)
        return;
    exports.cache.set(key, value, ttl);
}
function isCacheEnabled() {
    return cacheEnabled;
}
// Tool-specific cache functions
async function cachedSerpApiSearch(searchFunction, params) {
    if (!cacheEnabled) {
        return searchFunction();
    }
    const cacheKey = generateSerpApiCacheKey(params);
    const cached = getFromCache(cacheKey);
    if (cached) {
        return cached;
    }
    const result = await searchFunction();
    setInCache(cacheKey, result, 60000); // 1 minute TTL for SerpAPI
    return result;
}
async function cachedHttpFetch(fetchFunction, url, options) {
    if (!cacheEnabled) {
        return fetchFunction();
    }
    const cacheKey = generateHttpFetchCacheKey(url, options);
    const cached = getFromCache(cacheKey);
    if (cached) {
        return cached;
    }
    const result = await fetchFunction();
    setInCache(cacheKey, result, 30000); // 30 seconds TTL for HTTP fetch
    return result;
}
//# sourceMappingURL=cache.js.map