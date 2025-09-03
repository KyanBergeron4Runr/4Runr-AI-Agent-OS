import { FastifyInstance } from 'fastify';
export declare function adminRoutes(fastify: FastifyInstance): Promise<void>;
export declare function getChaosState(tool: string): {
    mode: string;
    pct: number;
} | undefined;
//# sourceMappingURL=admin.d.ts.map