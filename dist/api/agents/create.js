"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = route;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function route(app) {
    app.post("/api/agents", {
        schema: {
            body: {
                type: "object",
                required: ["name", "language", "entrypoint"],
                properties: {
                    name: { type: "string" },
                    language: { type: "string", enum: ["NODE", "PYTHON"] },
                    entrypoint: { type: "string" },
                    env: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } },
                    limitsCpu: { type: "number" },
                    limitsMemMb: { type: "integer" },
                    networkMode: { type: "string", enum: ["NONE", "EGRESS"] }
                }
            }
        }
    }, async (req, reply) => {
        const b = req.body;
        const agent = await prisma.runtimeAgent.create({
            data: {
                name: b.name,
                language: b.language,
                entrypoint: b.entrypoint,
                env: b.env ?? {},
                limitsCpu: b.limitsCpu ?? null,
                limitsMemMb: b.limitsMemMb ?? null,
                networkMode: (b.networkMode || "NONE"),
                sourceType: "ZIP",
                sourceUri: null
            }
        });
        return { agent };
    });
}
//# sourceMappingURL=create.js.map