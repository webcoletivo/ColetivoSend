import { PrismaClient } from '@prisma/client'
import path from 'path'
import dotenv from 'dotenv'

// Forçar o carregamento do .env na raiz do projeto (Hostinger Shared Hosting fix)
dotenv.config({ path: path.resolve(process.cwd(), '.env') })


const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
