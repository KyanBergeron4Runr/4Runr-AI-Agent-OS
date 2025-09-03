import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { launchRun } from "../runtime/runner";

const prisma = new PrismaClient();

const DEMO_ON = (process.env.DEMO_MODE || "off").toLowerCase() === "on";

// Rate limiting: one scenario start per agent per minute
const scenarioRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 60000; // 1 minute

export default async function demoRoutes(app: FastifyInstance) {
  app.post("/api/demo/seed", async (req, reply) => {
    if (!DEMO_ON) return reply.code(403).send({ error: "demo_mode_off" });

    // idempotent: if demo agents exist, return them
    const allAgents = await prisma.runtimeAgent.findMany();
    const existing = allAgents.filter(agent => {
      const tags = agent.tags as any;
      return Array.isArray(tags) && tags.includes("demo");
    });
    
    if (existing.length >= 3) {
      return reply.send({ ok: true, agents: existing });
    }

    // Create three demo agents (using your existing sample folders)
    const agents = await prisma.$transaction([
      prisma.runtimeAgent.create({
        data: {
          name: "Web Scraper (Node)",
          language: "NODE",
          entrypoint: "/app/index.js",
          limitsCpu: 0.5,
          limitsMemMb: 256,
          networkMode: "NONE",
          env: {},
          sourceType: "ZIP",
          sourceUri: path.resolve("agents-samples/node-hello"),
          tags: ["demo"],
        },
      }),
      prisma.runtimeAgent.create({
        data: {
          name: "API Monitor (Node)",
          language: "NODE",
          entrypoint: "/app/index.js",
          limitsCpu: 0.25,
          limitsMemMb: 128,
          networkMode: "NONE",
          env: {},
          sourceType: "ZIP",
          sourceUri: path.resolve("agents-samples/node-hello"),
          tags: ["demo"],
        },
      }),
      prisma.runtimeAgent.create({
        data: {
          name: "Content Bot (Python)",
          language: "PYTHON",
          entrypoint: "/app/main.py",
          limitsCpu: 0.25,
          limitsMemMb: 128,
          networkMode: "NONE",
          env: {},
          sourceType: "ZIP",
          sourceUri: path.resolve("agents-samples/python-hello"),
          tags: ["demo"],
        },
      }),
    ]);

    // Add schedules to first two
    for (const a of agents.slice(0,2)) {
      await prisma.runtimeSchedule.create({
        data: {
          agentId: a.id,
          cronExpr: "*/2 * * * *", // every 2 minutes
          enabled: true
        }
      });
    }

    // Start a run for agent[0] so logs are hot
    const a0 = agents[0];
    const { runId } = await launchRun({
      agentId: a0.id,
      language: a0.language as any,
      entrypoint: a0.entrypoint,
      hostMountPath: a0.sourceUri!,
      cpus: a0.limitsCpu ?? undefined,
      memMb: a0.limitsMemMb ?? undefined,
    });

    return reply.send({ ok: true, agents, hotRunId: runId });
  });

  app.post("/api/demo/reset", async (req, reply) => {
    if (!DEMO_ON) return reply.code(403).send({ error: "demo_mode_off" });

    // Delete runs, schedules, then agents with tag demo
    const allAgents = await prisma.runtimeAgent.findMany();
    const demoAgents = allAgents.filter(agent => {
      const tags = agent.tags as any;
      return Array.isArray(tags) && tags.includes("demo");
    });
    
    const ids = demoAgents.map(a => a.id);
    if (ids.length === 0) return reply.send({ ok: true, deleted: 0 });

    await prisma.runtimeSchedule.deleteMany({ where: { agentId: { in: ids } }});
    await prisma.runtimeRun.deleteMany({ where: { agentId: { in: ids } }});
    const res = await prisma.runtimeAgent.deleteMany({ where: { id: { in: ids } }});

    return reply.send({ ok: true, deleted: res.count });
  });

  // NEW: Demo scenarios
  app.get("/api/demo/scenarios", async (req, reply) => {
    if (!DEMO_ON) return reply.code(403).send({ error: "demo_mode_off" });

    return reply.send({
      scenarios: [
        {
          key: "healthy",
          name: "Healthy Agent",
          description: "Runs cleanly ~30s"
        },
        {
          key: "failing",
          name: "Auto-Restart Demo",
          description: "Intentional crash to show self-heal"
        },
        {
          key: "resourceHog",
          name: "Resource Spike",
          description: "Temporary CPU/memory spike ~10s"
        }
      ]
    });
  });

  app.post("/api/demo/runScenario", async (req, reply) => {
    if (!DEMO_ON) return reply.code(403).send({ error: "demo_mode_off" });

    const { scenario, agentId } = req.body as { scenario: string; agentId?: string };

    if (!scenario || !["healthy", "failing", "resourceHog"].includes(scenario)) {
      return reply.code(400).send({ error: "Invalid scenario" });
    }

    try {
      let targetAgentId = agentId;

      // If no agentId provided, create or reuse a demo agent
      if (!targetAgentId) {
        const allAgents = await prisma.runtimeAgent.findMany();
        const demoAgents = allAgents.filter(agent => {
          const tags = agent.tags as any;
          return Array.isArray(tags) && tags.includes("demo");
        });

        if (demoAgents.length === 0) {
          // Create a new demo agent
          const newAgent = await prisma.runtimeAgent.create({
            data: {
              name: `Scenario Agent (${scenario})`,
              language: "NODE",
              entrypoint: "/app/index.js",
              limitsCpu: 0.5,
              limitsMemMb: 256,
              networkMode: "NONE",
              env: {},
              sourceType: "ZIP",
              sourceUri: path.resolve("agents-samples/node-hello"),
              tags: ["demo"],
            },
          });
          targetAgentId = newAgent.id;
        } else {
          targetAgentId = demoAgents[0].id;
        }
      }

      // Rate limiting check
      const rateLimitKey = `${targetAgentId}_${scenario}`;
      const lastRun = scenarioRateLimit.get(rateLimitKey);
      if (lastRun && Date.now() - lastRun < RATE_LIMIT_MS) {
        return reply.code(429).send({ error: "Rate limited - try again in 1 minute" });
      }

      // Get the agent
      const agent = await prisma.runtimeAgent.findUnique({
        where: { id: targetAgentId }
      });

      if (!agent) {
        return reply.code(404).send({ error: "Agent not found" });
      }

      // Set scenario environment variables
      const env = {
        ...(agent.env as Record<string, any>),
        SCENARIO: scenario,
        ...(scenario === "resourceHog" && { SPIKE_MS: "10000" })
      };

      // Launch the scenario run
      const { runId } = await launchRun({
        agentId: targetAgentId,
        language: agent.language as any,
        entrypoint: agent.entrypoint,
        hostMountPath: agent.sourceUri!,
        cpus: agent.limitsCpu ?? undefined,
        memMb: agent.limitsMemMb ?? undefined,
        env
      });

      // Update rate limit
      scenarioRateLimit.set(rateLimitKey, Date.now());

      return reply.send({ 
        ok: true, 
        agentId: targetAgentId, 
        runId 
      });

    } catch (error) {
      console.error("Error running scenario:", error);
      return reply.code(500).send({ error: "Failed to run scenario" });
    }
  });
}
