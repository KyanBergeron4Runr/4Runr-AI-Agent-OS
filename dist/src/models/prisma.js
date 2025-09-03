"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Create a single PrismaClient instance that can be shared throughout the app
exports.prisma = new client_1.PrismaClient();
// Graceful shutdown
process.on('beforeExit', async () => {
    await exports.prisma.$disconnect();
});
//# sourceMappingURL=prisma.js.map