import Docker, { ContainerCreateOptions } from "dockerode";
const docker = new Docker(); // socket /var/run/docker.sock

export type StartOpts = {
  image: "agent-node:base" | "agent-python:base";
  agentId: string;
  runId: string;
  entrypoint: string;              // /app/index.js or /app/main.py
  hostMountPath: string;           // absolute path to agent code (mounted RO)
  cpus?: number;                   // e.g. 0.5
  memMb?: number;                  // e.g. 256
  network?: "none" | "bridge";     // MVP: none by default
};

export async function startContainer({
  image,
  agentId,
  runId,
  entrypoint,
  hostMountPath,
  cpus,
  memMb,
  network,
  env = {}
}: {
  image: string;
  agentId: string;
  runId: string;
  entrypoint: string;
  hostMountPath: string;
  cpus?: number;
  memMb?: number;
  network: string;
  env?: Record<string, any>;
}): Promise<string> {
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

export async function stopContainer(containerId: string, signal: string = "SIGTERM") {
  const container = docker.getContainer(containerId);
  try {
    await container.kill({ signal });
  } catch {}
  try {
    await container.remove({ force: true });
  } catch {}
}
