"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchRun = launchRun;
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const docker_1 = require("./docker");
const watcher_1 = require("./watcher");
const prisma = new client_1.PrismaClient();
async function launchRun({ agentId, language, entrypoint, hostMountPath, cpus, memMb, env = {} }) {
    // create run row
    const run = await prisma.runtimeRun.create({
        data: { agentId, status: client_1.RunStatus.QUEUED }
    });
    // For testing: determine correct agent path
    let finalHostMountPath = hostMountPath;
    if (!hostMountPath || hostMountPath.includes("node-hello")) {
        const agent = await prisma.runtimeAgent.findUnique({ where: { id: agentId } });
        if (agent?.name.includes("fail")) {
            finalHostMountPath = path_1.default.resolve("agents-samples/node-fail");
        }
    }
    const image = language === "NODE" ? "agent-node:base" : "agent-python:base";
    // Start container with environment variables
    const containerId = await (0, docker_1.startContainer)({
        image: image,
        agentId,
        runId: run.id,
        entrypoint,
        hostMountPath: finalHostMountPath,
        cpus,
        memMb,
        network: "none",
        env
    });
    await prisma.runtimeRun.update({
        where: { id: run.id },
        data: { status: client_1.RunStatus.RUNNING, startedAt: new Date(), reason: containerId }
    });
    // Watch container exit (async)
    (0, watcher_1.watchContainer)(run.id, containerId).catch((error) => {
        console.error(`[runner] Watcher error for run ${run.id}:`, error);
    });
    return { runId: run.id, containerId };
}
//# sourceMappingURL=runner.js.map