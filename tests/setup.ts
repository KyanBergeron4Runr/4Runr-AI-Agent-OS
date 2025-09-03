// tests/setup.ts
import { beforeAll, afterAll } from 'vitest'
import { prisma } from '../src/models/prisma'

beforeAll(async () => {
  // Ensure database is ready
  await prisma.$connect()
})

afterAll(async () => {
  // Clean up database connection
  await prisma.$disconnect()
})
