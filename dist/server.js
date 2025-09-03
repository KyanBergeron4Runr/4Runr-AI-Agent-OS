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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const validate_1 = require("./config/validate");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const agents_1 = require("./api/agents");
const tokens_1 = require("./api/tokens");
const proxy_1 = require("./api/proxy");
const policies_1 = require("./api/policies");
const admin_1 = require("./api/admin");
const sandbox_1 = require("./api/sandbox");
// import { healthRoutes } from './api/health' // MVP: Temporarily disabled
const lifecycle_1 = require("./runtime/lifecycle");
// Agent runtime routes
const create_1 = __importDefault(require("./api/agents/create"));
const start_1 = __importDefault(require("./api/agents/start"));
// Schedule routes
const create_2 = __importDefault(require("./api/schedules/create"));
const update_1 = __importDefault(require("./api/schedules/update"));
const delete_1 = __importDefault(require("./api/schedules/delete"));
const list_1 = __importDefault(require("./api/schedules/list"));
const toggle_1 = __importDefault(require("./api/schedules/toggle"));
// Monitoring routes
const streamLogs_1 = __importDefault(require("./api/runs/streamLogs"));
const status_1 = __importDefault(require("./api/agents/status"));
const metrics_1 = __importDefault(require("./api/agents/metrics"));
const summary_1 = __importDefault(require("./api/agents/summary"));
const kpis_1 = __importDefault(require("./api/summary/kpis"));
const demo_1 = __importDefault(require("./api/demo"));
// Services
const service_1 = require("./scheduler/service");
const stats_1 = require("./runtime/stats");
// Temporarily disabled for MVP
// import { memoryMonitor } from './runtime/memory-monitor'
// import { gatewayCircuitBreaker } from './runtime/circuit-breaker'
// import { rateLimitManager, RATE_LIMITS } from './runtime/rate-limiter'
// Add graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
// Add memory monitoring
setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
    };
    if (memUsageMB.heapUsed > 800) {
        console.log(`⚠️  High memory usage: ${memUsageMB.heapUsed}MB heap used`);
    }
}, 30000); // Check every 30 seconds
// Validate environment variables before starting
try {
    (0, validate_1.validateEnv)();
    console.log('✅ Environment validation passed');
}
catch (error) {
    console.error('❌ Environment validation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
}
// Create Fastify instance with connection limits
const server = (0, fastify_1.default)({
    logger: true,
    connectionTimeout: 10000, // 10 second timeout
    keepAliveTimeout: 5000, // 5 second keep-alive
    maxParamLength: 1000, // Limit parameter length
    bodyLimit: 1048576 * 10, // 10MB body limit
    // Remove server factory for now - causes type issues
});
// Register CORS plugin
server.register(cors_1.default, {
    origin: true // Allow all origins for development
});
// MVP: Rate limiting temporarily disabled for core agent runtime implementation
// Will re-enable after agent runtime is working
// MVP: Circuit breaker temporarily disabled for core agent runtime implementation
// Will re-enable after agent runtime is working
// Register API routes
server.register(agents_1.agentRoutes, { prefix: '/api' });
server.register(tokens_1.tokenRoutes, { prefix: '/api' });
server.register(proxy_1.proxyRoutes, { prefix: '/api' });
server.register(policies_1.policyRoutes, { prefix: '/api' });
server.register(admin_1.adminRoutes, { prefix: '/api' });
server.register(sandbox_1.sandboxRoutes, { prefix: '/api' });
// server.register(healthRoutes) // MVP: Temporarily disabled
// Register Agent Runtime routes  
server.register(create_1.default);
server.register(start_1.default);
// Register Schedule routes
server.register(create_2.default);
server.register(update_1.default);
server.register(delete_1.default);
server.register(list_1.default);
server.register(toggle_1.default);
// Register Monitoring routes
server.register(streamLogs_1.default);
server.register(status_1.default);
server.register(metrics_1.default);
server.register(summary_1.default);
server.register(kpis_1.default);
server.register(demo_1.default);
// Simple health endpoint for MVP
server.get('/health', async () => {
    return { status: 'ok', service: '4runr-agent-runtime', timestamp: new Date().toISOString() };
});
// Start server
const start = async () => {
    try {
        // MVP: Memory monitoring temporarily disabled for core agent runtime implementation
        // Start scheduler service
        await (0, service_1.startSchedulerService)();
        // Start stats sampler
        (0, stats_1.startStatsSampler)();
        // Start server
        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('🚀 4Runr Gateway server running on http://localhost:3000');
        console.log('🤖 AI Agent Runtime MVP active - ready for agent deployment!');
        console.log('⏰ Scheduler service active - ready for cron-based agent execution!');
        console.log('📊 Monitoring active - resource tracking and auto-restart enabled!');
        // Register server shutdown handler
        lifecycle_1.lifecycleManager.onShutdown(async () => {
            console.log('Shutting down Fastify server...');
            await server.close();
        });
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=server.js.map