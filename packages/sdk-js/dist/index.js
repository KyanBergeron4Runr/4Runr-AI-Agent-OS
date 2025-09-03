"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayClient = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@4runr/shared");
class GatewayClient {
    constructor(config) {
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.client.interceptors.request.use((config) => {
            shared_1.logger.debug(`Making request to: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            shared_1.logger.error('Request error:', error);
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            shared_1.logger.debug(`Response received: ${response.status} ${response.config.url}`);
            return response;
        }, (error) => {
            shared_1.logger.error('Response error:', error.response?.data || error.message);
            return Promise.reject(error);
        });
    }
    async health() {
        const response = await this.client.get('/health');
        return response.data;
    }
    async ready() {
        const response = await this.client.get('/ready');
        return response.data;
    }
    async createAgent(agent) {
        const response = await this.client.post('/api/agents', agent);
        return response.data;
    }
    async getAgent(agentId) {
        const response = await this.client.get(`/api/agents/${agentId}`);
        return response.data;
    }
    async listAgents() {
        const response = await this.client.get('/api/agents');
        return response.data;
    }
    async startAgent(agentId) {
        const response = await this.client.post(`/api/agents/${agentId}/start`);
        return response.data;
    }
    async getSentinelHealth() {
        const response = await this.client.get('/api/sentinel/health');
        return response.data;
    }
    async getSentinelMetrics() {
        const response = await this.client.get('/api/sentinel/metrics');
        return response.data;
    }
    async getSentinelConfig() {
        const response = await this.client.get('/api/sentinel/config');
        return response.data;
    }
    async updateSentinelConfig(config) {
        const response = await this.client.post('/api/sentinel/config', config);
        return response.data;
    }
    async getCoachReport(agentId, runCount) {
        const params = runCount ? { runCount } : {};
        const response = await this.client.get(`/api/coach/report/${agentId}`, { params });
        return response.data;
    }
    async startCoachExperiment(agentId, patchProposal) {
        const response = await this.client.post('/api/coach/experiment/start', {
            agentId,
            patchProposal
        });
        return response.data;
    }
    createSSEConnection(runId) {
        return new EventSource(`${this.config.baseUrl}/api/runs/${runId}/guard/stream`);
    }
    async emitDemoRun(agentId, input) {
        const response = await this.client.post('/api/diagnostics/emit-demo-run', {
            agentId,
            input
        });
        return response.data;
    }
    getBaseUrl() {
        return this.config.baseUrl;
    }
    getAgentId() {
        return this.config.agentId;
    }
}
exports.GatewayClient = GatewayClient;
exports.default = GatewayClient;
//# sourceMappingURL=index.js.map