import { recordCacheHit } from '../observability/metrics'

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
}

export class LRUCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number
  private defaultTtl: number
  private stats: CacheStats

  constructor(maxSize: number = 1000, defaultTtl: number = 60000) {
    this.maxSize = maxSize
    this.defaultTtl = defaultTtl
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize
    }
  }

  set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl
    }

    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key)
      this.stats.size--
    }

    // Evict if at capacity
    if (this.stats.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, entry)
    this.stats.size++
  }

  get(key: string, tool?: string, action?: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.size--
      this.stats.misses++
      return null
    }

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    this.stats.hits++
    // Record cache hit with tool/action context if available
    if (tool && action) {
      recordCacheHit(tool, action)
    }
    return entry.value
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.size--
      return false
    }
    
    return true
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.size--
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.stats.size = 0
  }

  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.cache.delete(firstKey)
      this.stats.size--
    }
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses
    return total > 0 ? this.stats.hits / total : 0
  }
}

// Cache configuration
const cacheEnabled = process.env.CACHE_ENABLED !== 'false'
const cacheTtlMs = parseInt(process.env.CACHE_TTL_MS || '60000') // 1 minute
const cacheMaxSize = parseInt(process.env.CACHE_MAX_SIZE || '1000')

// Global cache instance
export const cache = new LRUCache(cacheMaxSize, cacheTtlMs)

// Cache key generators
export function generateSerpApiCacheKey(params: any): string {
  const { q, engine, location, num } = params
  return `serpapi:${JSON.stringify({ q, engine, location, num })}`
}

export function generateHttpFetchCacheKey(url: string, options?: any): string {
  const method = options?.method || 'GET'
  const headers = options?.headers ? JSON.stringify(options.headers) : ''
  return `http_fetch:${method}:${url}:${headers}`
}

// Cache utilities
export function getFromCache<T>(key: string): T | null {
  if (!cacheEnabled) return null
  return cache.get(key)
}

export function setInCache<T>(key: string, value: T, ttl?: number): void {
  if (!cacheEnabled) return
  cache.set(key, value, ttl)
}

export function isCacheEnabled(): boolean {
  return cacheEnabled
}

// Tool-specific cache functions
export async function cachedSerpApiSearch(
  searchFunction: () => Promise<any>,
  params: any
): Promise<any> {
  if (!cacheEnabled) {
    return searchFunction()
  }

  const cacheKey = generateSerpApiCacheKey(params)
  const cached = getFromCache(cacheKey)
  
  if (cached) {
    return cached
  }

  const result = await searchFunction()
  setInCache(cacheKey, result, 60000) // 1 minute TTL for SerpAPI
  return result
}

export async function cachedHttpFetch(
  fetchFunction: () => Promise<any>,
  url: string,
  options?: any
): Promise<any> {
  if (!cacheEnabled) {
    return fetchFunction()
  }

  const cacheKey = generateHttpFetchCacheKey(url, options)
  const cached = getFromCache(cacheKey)
  
  if (cached) {
    return cached
  }

  const result = await fetchFunction()
  setInCache(cacheKey, result, 30000) // 30 seconds TTL for HTTP fetch
  return result
}
