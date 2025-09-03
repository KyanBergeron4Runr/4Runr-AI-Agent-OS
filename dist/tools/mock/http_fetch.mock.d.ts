export declare function get(params: {
    url: string;
    timeoutMs?: number;
}): Promise<{
    url: string;
    status: number;
    headers: {
        'content-type': string;
    };
    body: string;
    bytes: number;
}>;
//# sourceMappingURL=http_fetch.mock.d.ts.map