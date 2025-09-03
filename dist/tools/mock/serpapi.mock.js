"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = search;
async function search(params) {
    // deterministic, cacheable payload
    return {
        source: 'serpapi-mock',
        query: params.q,
        results: Array.from({ length: Math.min(params.num ?? 10, 10) }, (_, i) => ({
            title: `Result ${i + 1} for ${params.q}`,
            url: `https://example.com/${encodeURIComponent(params.q)}/${i + 1}`
        })),
        ts: Date.now()
    };
}
//# sourceMappingURL=serpapi.mock.js.map