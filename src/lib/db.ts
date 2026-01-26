import { PrismaClient } from '@prisma/client'
import path from 'path'
import dotenv from 'dotenv'

// Forçar o carregamento do .env na raiz do projeto (Hostinger Shared Hosting fix)
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

// Polyfill for BigInt serialization - Global Patch for JSON.stringify to handle Prisma BigInt
declare global {
  interface BigInt {
    toJSON(): string | number;
  }
}

if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    const int = Number(this)
    return Number.MAX_SAFE_INTEGER > int && int > Number.MIN_SAFE_INTEGER
      ? int
      : this.toString()
  }
}


const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
