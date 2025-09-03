/**
 * HTTP Fetch Tool Adapter
 * Handles safe HTTP requests with allowlist and limits
 */
export interface HttpFetchParams {
    url: string;
    method?: 'GET' | 'HEAD';
    timeout?: number;
    maxSize?: number;
}
export declare class HttpFetchTool {
    /**
     * Check if a URL is allowed
     */
    private isUrlAllowed;
    /**
     * Perform a safe HTTP GET request
     */
    get(params: HttpFetchParams): Promise<any>;
    /**
     * Perform a safe HTTP HEAD request
     */
    head(params: HttpFetchParams): Promise<any>;
}
export declare const httpFetchTool: HttpFetchTool;
//# sourceMappingURL=http-fetch.d.ts.map