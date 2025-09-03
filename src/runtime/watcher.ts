import Docker from "dockerode";
import { PrismaClient, RunStatus } from "@prisma/client";
import { launchRun } from "./runner";
const prisma = new PrismaClient();
const docker = new Docker();

type RestartPolicy = {
  maxRestarts: number;
  backoffMs: number;
};

export async function watchContainer(runId: string, containerId: string) {
  const container = docker.getContainer(containerId);
  // Wait for container to stop
  try {
    await container.wait();
  } catch (e) {
    // If wait fails, continue to inspect
  }

  // Inspect for exit code
  let exitCode = 1;
  try {
    const info = await container.inspect();
    exitCode = info?.State?.ExitCode ?? 1;
  } catch {}

  // Update DB
  const run = await prisma.runtimeRun.findUnique({ where: { id: runId }, include: { agent: true } });
  if (!run) return;

  const succeeded = exitCode === 0;
  await prisma.runtimeRun.update({
    where: { id: runId },
    data: {
      status: succeeded ? RunStatus.SUCCEEDED : RunStatus.FAILED,
      endedAt: new Date(),
      exitCode
    }
  });

  if (!succeeded) {
    // Auto-restart if allowed
    const policy: RestartPolicy = {
      maxRestarts: run.agent.maxRestarts ?? Number(process.env.RUNTIME_MAX_RESTARTS || 2),
      backoffMs: run.agent.restartBackoffMs ?? Number(process.env.RUNTIME_RESTART_BACKOFF_MS || 5000)
    };

    if (run.restarts < policy.maxRestarts) {
      const delay = policy.backoffMs * Math.pow(2, run.restarts); // simple exponential backoff
      console.log(`[watcher] Scheduling restart ${run.restarts + 1}/${policy.maxRestarts} for run ${runId} in ${delay}ms`);
      
      setTimeout(async () => {
        // create a new run
        const agent = await prisma.runtimeAgent.findUnique({ where: { id: run.agentId } });
        if (!agent) return;
        
        try {
          const { runId: restartRunId } = await launchRun({
            agentId: agent.id,
            language: agent.language as any,
            entrypoint: agent.entrypoint,
            hostMountPath: resolveHostMount(agent),
            cpus: agent.limitsCpu ?? undefined,
            memMb: agent.limitsMemMb ?? undefined,
            env: agent.env as Record<string, any>
          });

          // increment restarts on new run
          await prisma.runtimeRun.update({
            where: { id: restartRunId },
            data: { restarts: (run.restarts ?? 0) + 1 }
          });
          
          console.log(`[watcher] Restarted run ${runId} -> ${restartRunId} (restart ${run.restarts + 1})`);
        } catch (error) {
          console.error(`[watcher] Failed to restart run ${runId}:`, error);
        }
      }, delay);
    } else {
      console.log(`[watcher] Run ${runId} failed and reached max restarts (${policy.maxRestarts})`);
    }
  } else {
    console.log(`[watcher] Run ${runId} completed successfully`);
  }
}

function resolveHostMount(agent: any) {
  // MVP: determine path based on agent name for testing
  const path = require("path");
  if (agent.language === "NODE") {
    if (agent.name.includes("fail")) {
      return path.resolve("agents-samples/node-fail");
    }
    return path.resolve("agents-samples/node-hello");
  }
  return path.resolve("agents-samples/python-hello");
}
