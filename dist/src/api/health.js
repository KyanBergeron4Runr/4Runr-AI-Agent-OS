"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const lifecycle_1 = require("../runtime/lifecycle");
const metrics_1 = require("../observability/metrics");
async function healthRoutes(fastify) {
    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
        const health = (0, lifecycle_1.getHealthStatus)();
        return reply.code(200).send(health);
    });
    // Readiness check endpoint
    fastify.get('/ready', async (request, reply) => {
        const readiness = await (0, lifecycle_1.getReadinessStatus)();
        const statusCode = readiness.ready ? 200 : 503;
        return reply.code(statusCode).send(readiness);
    });
    // Metrics endpoint (Prometheus format)
    fastify.get('/metrics', async (request, reply) => {
        const metrics = (0, metrics_1.getMetricsResponse)();
        reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        return reply.code(200).send(metrics);
    });
}
//# sourceMappingURL=health.js.map