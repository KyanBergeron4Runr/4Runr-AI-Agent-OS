"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = get;
async function get(params) {
    // simple synthetic page; enforce policy caps upstream if you want
    return {
        url: params.url,
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: `<html><head><title>Mock</title></head><body><h1>${params.url}</h1><p>hello</p></body></html>`,
        bytes: 120
    };
}
//# sourceMappingURL=http_fetch.mock.js.map