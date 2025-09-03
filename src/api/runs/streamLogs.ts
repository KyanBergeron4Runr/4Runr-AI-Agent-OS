import { FastifyInstance } from "fastify";
import Docker from "dockerode";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const docker = new Docker();

export default async function route(app: FastifyInstance) {
  app.get("/api/runs/:id/logs/stream", async (req, reply) => {
    const { id } = req.params as any;
    const run = await prisma.runtimeRun.findUnique({ where: { id } });
    if (!run || !run.reason) {
      reply.code(404);
      return { error: "run_or_container_not_found" };
    }
    const container = docker.getContainer(run.reason);

    // SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.flushHeaders?.();

    const backfill = Number(process.env.LOGS_BACKFILL_LINES || 200);
    
    try {
      const logStream = await container.logs({ follow: true, stdout: true, stderr: true, tail: backfill });

      logStream.on("data", (chunk: Buffer) => {
        // Docker multiplexes stdout/stderr; in alpine base it's usually raw text.
        const text = chunk.toString("utf8").trim();
        if (text) {
          reply.raw.write(`data: ${JSON.stringify({ log: text, timestamp: new Date().toISOString() })}\\n\\n`);
        }
      });
      
      logStream.on("end", () => {
        reply.raw.write(`event: end\\ndata: "eof"\\n\\n`);
        reply.raw.end();
      });
      
      logStream.on("error", (error) => {
        reply.raw.write(`event: error\\ndata: ${JSON.stringify({ error: error.message })}\\n\\n`);
        reply.raw.end();
      });

      // Close on client disconnect
      req.raw.on("close", () => {
        try { 
          if (logStream && typeof (logStream as any).destroy === 'function') {
            (logStream as any).destroy();
          }
          reply.raw.end();
        } catch {}
      });
      
      // Send initial connection event
      reply.raw.write(`event: connected\\ndata: ${JSON.stringify({ runId: id, containerId: run.reason })}\\n\\n`);
      
    } catch (error) {
      reply.raw.write(`event: error\\ndata: ${JSON.stringify({ error: "Container not accessible" })}\\n\\n`);
      reply.raw.end();
    }

    return reply; // keep open
  });
}
