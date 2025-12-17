import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import net from 'net'

export const dynamic = 'force-dynamic'

async function checkTcpConnection(host: string, port: number, timeout = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    socket.setTimeout(timeout)
    socket.on('connect', () => { socket.destroy(); resolve('Connected!') })
    socket.on('timeout', () => { socket.destroy(); resolve('Timeout') })
    socket.on('error', (err) => { socket.destroy(); resolve(`Error: ${err.message}`) })
    try { socket.connect(port, host) } catch (e: any) { resolve(`Socket Error: ${e.message}`) }
  })
}

export async function GET() {
  const envDump = Object.keys(process.env).sort();
  
  // Hardcoded checks
  const localCheck = await checkTcpConnection('127.0.0.1', 3306);
  const dockerCheck = await checkTcpConnection('172.17.0.1', 3306, 1000);
  
  return NextResponse.json({
    version: 'V3_FRESH_ROUTE',
    timestamp: new Date().toISOString(),
    network: {
      localhost: localCheck,
      docker_gateway: dockerCheck
    },
    env_vars_found: envDump.filter(k => !k.includes('KEY') && !k.includes('SECRET')),
    has_database_url: !!process.env.DATABASE_URL
  })
}
