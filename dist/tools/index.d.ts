declare const use: {
    serpapi: {
        search: (params: any) => Promise<{
            source: string;
            query: string;
            results: {
                title: string;
                url: string;
            }[];
            ts: number;
        }>;
        isConfigured: () => Promise<boolean>;
    };
    http_fetch: {
        get: (params: any) => Promise<{
            url: string;
            status: number;
            headers: {
                'content-type': string;
            };
            body: string;
            bytes: number;
        }>;
        head: (params: any) => Promise<{
            url: any;
            status: number;
            headers: {
                'content-type': string;
            };
            bytes: number;
        }>;
        isConfigured: () => Promise<boolean>;
    };
    openai: {
        chat: (params: any) => Promise<{
            model: string;
            output: string;
            tokens_est: number;
        }>;
        complete: (params: any) => Promise<{
            model: any;
            output: string;
            tokens_est: number;
        }>;
        isConfigured: () => Promise<boolean>;
    };
    gmail_send: {
        send: (params: any) => Promise<{
            id: string;
            to: string;
            status: string;
            subject_len: number;
            body_len: number;
        }>;
        getProfile: () => Promise<{
            email: string;
            name: string;
            status: string;
        }>;
        isConfigured: () => Promise<boolean>;
    };
} | {
    serpapi: import("./serpapi").SerpApiTool;
    http_fetch: import("./http-fetch").HttpFetchTool;
    openai: import("./openai").OpenAITool;
    gmail_send: import("./gmail-send").GmailSendTool;
};
export declare const routes: Record<string, Record<string, (params: any) => Promise<any>>>;
export declare const currentMode: string;
export { use };
//# sourceMappingURL=index.d.ts.map