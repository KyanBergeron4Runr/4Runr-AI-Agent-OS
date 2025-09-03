import { AxiosRequestConfig, AxiosResponse } from 'axios';
declare module 'axios' {
    interface AxiosRequestConfig {
        metadata?: {
            context?: RequestContext;
            startTime?: number;
            duration?: number;
        };
    }
    interface InternalAxiosRequestConfig {
        metadata?: {
            context?: RequestContext;
            startTime?: number;
            duration?: number;
        };
    }
}
export interface HttpClientConfig {
    timeoutMs: number;
    keepAlive: boolean;
    maxRedirects: number;
    maxBodySize: number;
}
export interface RequestContext {
    correlationId: string;
    agentId?: string;
    tool?: string;
    action?: string;
}
export declare class HardenedHttpClient {
    private client;
    private config;
    constructor(config: HttpClientConfig);
    private setupInterceptors;
    request<T = any>(config: AxiosRequestConfig & {
        context?: RequestContext;
    }): Promise<AxiosResponse<T>>;
    get<T = any>(url: string, config?: AxiosRequestConfig & {
        context?: RequestContext;
    }): Promise<AxiosResponse<T>>;
    head<T = any>(url: string, config?: AxiosRequestConfig & {
        context?: RequestContext;
    }): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig & {
        context?: RequestContext;
    }): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig & {
        context?: RequestContext;
    }): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig & {
        context?: RequestContext;
    }): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig & {
        context?: RequestContext;
    }): Promise<AxiosResponse<T>>;
    getConfig(): HttpClientConfig;
}
export declare const httpClient: HardenedHttpClient;
export declare function generateCorrelationId(): string;
export declare function getRequestContext(response: AxiosResponse): RequestContext | undefined;
export declare function getRequestDuration(response: AxiosResponse): number | undefined;
//# sourceMappingURL=http.d.ts.map