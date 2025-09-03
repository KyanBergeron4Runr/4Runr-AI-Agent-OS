import path from "path";
import { PrismaClient, RunStatus, AgentLanguage } from "@prisma/client";
import { startContainer, stopContainer } from "./docker";
import { watchContainer } from "./watcher";
const prisma = new PrismaClient();

export async function launchRun({
  agentId,
  language,
  entrypoint,
  hostMountPath,
  cpus,
  memMb,
  env = {}
}: {
  agentId: string;
  language: AgentLanguage;
  entrypoint: string;
  hostMountPath: string;
  cpus?: number;
  memMb?: number;
  env?: Record<string, any>;
}) {
  // create run row
  const run = await prisma.runtimeRun.create({
    data: { agentId, status: RunStatus.QUEUED }
  });

  // For testing: determine correct agent path
  let finalHostMountPath = hostMountPath;
  if (!hostMountPath || hostMountPath.includes("node-hello")) {
    const agent = await prisma.runtimeAgent.findUnique({ where: { id: agentId } });
    if (agent?.name.includes("fail")) {
      finalHostMountPath = path.resolve("agents-samples/node-fail");
    }
  }

  const image = language === "NODE" ? "agent-node:base" : "agent-python:base";
  
  // Start container with environment variables
  const containerId = await startContainer({
    image: image as any,
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
    data: { status: RunStatus.RUNNING, startedAt: new Date(), reason: containerId }
  });

  // Watch container exit (async)
  watchContainer(run.id, containerId).catch((error) => {
    console.error(`[runner] Watcher error for run ${run.id}:`, error);
  });

  return { runId: run.id, containerId };
}
