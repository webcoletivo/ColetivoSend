import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const allKeys = Object.keys(process.env).sort()
  
  const envDump = allKeys.reduce((acc, key) => {
    // Hide secrets for security, but show keys
    const isSecret = key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN') || key.includes('PASSWORD');
    acc[key] = isSecret ? '***HIDDEN***' : process.env[key]?.substring(0, 50);
    return acc;
  }, {} as Record<string, string | undefined>)

  return NextResponse.json({
    status: 'success',
    message: 'Env Check - No Prisma Dependency',
    database_url_exists: !!process.env.DATABASE_URL,
    // explicitly show the connection string structure if it exists (masking password)
    database_url_structure: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : 'MISSING',
    env_vars: envDump
  })
}
