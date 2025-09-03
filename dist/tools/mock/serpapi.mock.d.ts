export declare function search(params: {
    q: string;
    engine?: string;
    location?: string;
    num?: number;
}): Promise<{
    source: string;
    query: string;
    results: {
        title: string;
        url: string;
    }[];
    ts: number;
}>;
//# sourceMappingURL=serpapi.mock.d.ts.map