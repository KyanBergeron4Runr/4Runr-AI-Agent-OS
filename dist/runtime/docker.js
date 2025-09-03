"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startContainer = startContainer;
exports.stopContainer = stopContainer;
const dockerode_1 = __importDefault(require("dockerode"));
const docker = new dockerode_1.default(); // socket /var/run/docker.sock
async function startContainer({ image, agentId, runId, entrypoint, hostMountPath, cpus, memMb, network, env = {} }) {
    const containerPath = "/app";
    const containerName = `agent-${agentId}-${runId}`;
    const container = await docker.createContainer({
        Image: image,
        name: containerName,
        Cmd: [entrypoint],
        Env: Object.entries(env).map(([key, value]) => `${key}=${value}`),
        HostConfig: {
            Binds: [`${hostMountPath}:${containerPath}:ro`],
            Memory: memMb ? memMb * 1024 * 1024 : undefined,
            CpuQuota: cpus ? Math.floor(cpus * 100000) : undefined,
            CpuPeriod: 100000,
            ReadonlyRootfs: true,
            SecurityOpt: ['no-new-privileges'],
            NetworkMode: network
        }
    });
    await container.start();
    return container.id;
}
async function stopContainer(containerId, signal = "SIGTERM") {
    const container = docker.getContainer(containerId);
    try {
        await container.kill({ signal });
    }
    catch { }
    try {
        await container.remove({ force: true });
    }
    catch { }
}
//# sourceMappingURL=docker.js.map