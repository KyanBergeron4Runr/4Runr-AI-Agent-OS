"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = route;
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const runner_1 = require("../../runtime/runner");
const prisma = new client_1.PrismaClient();
async function route(app) {
    app.post("/api/agents/:id/start", {}, async (req, reply) => {
        const { id } = req.params;
        const agent = await prisma.runtimeAgent.findUnique({ where: { id } });
        if (!agent)
            return reply.code(404).send({ error: "not_found" });
        // MVP: map sample code by language
        const hostMountPath = path_1.default.resolve(agent.language === "NODE" ? "agents-samples/node-hello" : "agents-samples/python-hello");
        const { runId, containerId } = await (0, runner_1.launchRun)({
            agentId: agent.id,
            language: agent.language,
            entrypoint: agent.entrypoint,
            hostMountPath,
            cpus: agent.limitsCpu ?? undefined,
            memMb: agent.limitsMemMb ?? undefined
        });
        return { runId, containerId };
    });
}
//# sourceMappingURL=start.js.map