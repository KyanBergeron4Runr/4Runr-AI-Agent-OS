/**
 * SerpAPI Tool Adapter
 * Handles search requests through SerpAPI
 */
export interface SerpApiSearchParams {
    q: string;
    engine?: string;
    location?: string;
    num?: number;
    start?: number;
    [key: string]: any;
}
export declare class SerpApiTool {
    private apiKey?;
    constructor();
    /**
     * Check if SerpAPI is configured
     */
    isConfigured(): Promise<boolean>;
    /**
     * Perform a search using SerpAPI
     */
    search(params: SerpApiSearchParams): Promise<any>;
}
export declare const serpApiTool: SerpApiTool;
//# sourceMappingURL=serpapi.d.ts.map