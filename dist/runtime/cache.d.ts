interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
}
export declare class LRUCache<T = any> {
    private cache;
    private maxSize;
    private defaultTtl;
    private stats;
    constructor(maxSize?: number, defaultTtl?: number);
    set(key: string, value: T, ttl?: number): void;
    get(key: string, tool?: string, action?: string): T | null;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    private evictOldest;
    getStats(): CacheStats;
    getHitRate(): number;
}
export declare const cache: LRUCache<any>;
export declare function generateSerpApiCacheKey(params: any): string;
export declare function generateHttpFetchCacheKey(url: string, options?: any): string;
export declare function getFromCache<T>(key: string): T | null;
export declare function setInCache<T>(key: string, value: T, ttl?: number): void;
export declare function isCacheEnabled(): boolean;
export declare function cachedSerpApiSearch(searchFunction: () => Promise<any>, params: any): Promise<any>;
export declare function cachedHttpFetch(fetchFunction: () => Promise<any>, url: string, options?: any): Promise<any>;
export {};
//# sourceMappingURL=cache.d.ts.map