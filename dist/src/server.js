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
const health_1 = require("./api/health");
const lifecycle_1 = require("./runtime/lifecycle");
// Validate environment variables before starting
try {
    (0, validate_1.validateEnv)();
    console.log('✅ Environment validation passed');
}
catch (error) {
    console.error('❌ Environment validation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
}
// Create Fastify instance
const server = (0, fastify_1.default)({
    logger: true
});
// Register CORS plugin
server.register(cors_1.default, {
    origin: true // Allow all origins for development
});
// Register API routes
server.register(agents_1.agentRoutes, { prefix: '/api' });
server.register(tokens_1.tokenRoutes, { prefix: '/api' });
server.register(proxy_1.proxyRoutes, { prefix: '/api' });
server.register(policies_1.policyRoutes, { prefix: '/api' });
server.register(admin_1.adminRoutes, { prefix: '/api' });
server.register(health_1.healthRoutes); // Health routes at root level
// Start server
const start = async () => {
    try {
        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('🚀 4Runr Gateway server running on http://localhost:3000');
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