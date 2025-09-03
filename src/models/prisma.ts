import { PrismaClient } from '@prisma/client'

// Create a single PrismaClient instance that can be shared throughout the app
export const prisma = new PrismaClient()

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
