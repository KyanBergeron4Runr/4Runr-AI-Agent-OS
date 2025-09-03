"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.use = exports.currentMode = exports.routes = void 0;
const upstreamMode = (process.env.UPSTREAM_MODE || 'live').toLowerCase();
// live adapters
const serpapi_1 = require("./serpapi");
const http_fetch_1 = require("./http-fetch");
const openai_1 = require("./openai");
const gmail_send_1 = require("./gmail-send");
// mock adapters
const serpapiMock = __importStar(require("./mock/serpapi.mock"));
const httpFetchMock = __importStar(require("./mock/http_fetch.mock"));
const openaiMock = __importStar(require("./mock/openai.mock"));
const gmailSendMock = __importStar(require("./mock/gmail_send.mock"));
// Chaos injection function for mocks
function maybeChaos() {
    if ((process.env.FF_CHAOS || 'off') === 'on') {
        if (Math.random() < 0.2) { // 20% fail
            const ms = 300 + Math.random() * 1200;
            return new Promise((_, rej) => setTimeout(() => rej(new Error('mock 503')), ms));
        }
    }
}
// Create mock tool objects that match the live tool interfaces
const serpapiMockTool = {
    search: async (params) => {
        await maybeChaos();
        return serpapiMock.search(params);
    },
    isConfigured: async () => true
};
const httpFetchMockTool = {
    get: async (params) => {
        await maybeChaos();
        return httpFetchMock.get(params);
    },
    head: async (params) => {
        await maybeChaos();
        return {
            url: params.url,
            status: 200,
            headers: { 'content-type': 'text/html' },
            bytes: 120
        };
    },
    isConfigured: async () => true
};
const openaiMockTool = {
    chat: async (params) => {
        await maybeChaos();
        return openaiMock.chat(params);
    },
    complete: async (params) => {
        await maybeChaos();
        return {
            model: params.model,
            output: `COMPLETION: ${params.prompt.slice(0, 100)}...`,
            tokens_est: Math.ceil(params.prompt.length / 3)
        };
    },
    isConfigured: async () => true
};
const gmailSendMockTool = {
    send: async (params) => {
        await maybeChaos();
        return gmailSendMock.send(params);
    },
    getProfile: async () => {
        await maybeChaos();
        return {
            email: 'mock@example.com',
            name: 'Mock User',
            status: 'active'
        };
    },
    isConfigured: async () => true
};
const use = upstreamMode === 'mock' ? {
    serpapi: serpapiMockTool,
    http_fetch: httpFetchMockTool,
    openai: openaiMockTool,
    gmail_send: gmailSendMockTool
} : {
    serpapi: serpapi_1.serpApiTool,
    http_fetch: http_fetch_1.httpFetchTool,
    openai: openai_1.openaiTool,
    gmail_send: gmail_send_1.gmailSendTool
};
exports.use = use;
exports.routes = {
    serpapi: { search: use.serpapi.search },
    http_fetch: {
        get: use.http_fetch.get,
        head: use.http_fetch.head
    },
    openai: {
        chat: use.openai.chat,
        complete: use.openai.complete
    },
    gmail_send: {
        send: use.gmail_send.send,
        profile: use.gmail_send.getProfile
    }
};
// Export the mode for logging/debugging
exports.currentMode = upstreamMode;
//# sourceMappingURL=index.js.map