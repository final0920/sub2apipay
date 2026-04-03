import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '@/lib/config';

const { PrismaClient } = require('@prisma/client') as { PrismaClient: new (options?: unknown) => any };

const globalForPrisma = globalThis as unknown as { prisma: any };

function createPrismaClient() {
  const connectionString = getEnv().DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
