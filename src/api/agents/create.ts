import { FastifyInstance } from "fastify";
import { PrismaClient, AgentLanguage, NetworkMode } from "@prisma/client";
const prisma = new PrismaClient();

export default async function route(app: FastifyInstance) {
  app.post("/api/agents", {
    schema: {
      body: {
        type: "object",
        required: ["name", "language", "entrypoint"],
        properties: {
          name: { type: "string" },
          language: { type: "string", enum: ["NODE","PYTHON"] },
          entrypoint: { type: "string" },
          env: { type: "object", additionalProperties: { type: ["string","number","boolean"] } },
          limitsCpu: { type: "number" },
          limitsMemMb: { type: "integer" },
          networkMode: { type: "string", enum: ["NONE","EGRESS"] }
        }
      }
    }
  }, async (req, reply) => {
    const b: any = req.body;
    const agent = await prisma.runtimeAgent.create({
      data: {
        name: b.name,
        language: b.language as AgentLanguage,
        entrypoint: b.entrypoint,
        env: b.env ?? {},
        limitsCpu: b.limitsCpu ?? null,
        limitsMemMb: b.limitsMemMb ?? null,
        networkMode: (b.networkMode || "NONE") as NetworkMode,
        sourceType: "ZIP",
        sourceUri: null
      }
    });
    return { agent };
  });
}
