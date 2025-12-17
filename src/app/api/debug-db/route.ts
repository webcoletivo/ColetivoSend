import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import net from 'net'
import { URL } from 'url'

export const dynamic = 'force-dynamic'

async function checkTcpConnection(host: string, port: number, timeout = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let status = 'pending'

    socket.setTimeout(timeout)

    socket.on('connect', () => {
      status = 'connected'
      socket.destroy()
      resolve('Connected!')
    })

    socket.on('timeout', () => {
      status = 'timeout'
      socket.destroy()
      resolve('Timeout (Firewall/Wrong IP)')
    })

    socket.on('error', (err) => {
      status = 'error'
      socket.destroy()
      resolve(`Error: ${err.message}`)
    })

    try {
      socket.connect(port, host)
    } catch (e: any) {
      resolve(`Socket Error: ${e.message}`)
    }
  })
}

export async function GET() {
  const startTime = Date.now()
  let dbUrlInfo = null
  let tcpResult = 'Skipped'
  
  try {
    // 1. Parse DB URL
    // 1. HARDCODED CHECK (To bypass missing env var)
    const hardcodedHost = '127.0.0.1'; 
    const hardcodedPort = 3306;
    
    // Check 1: Raw TCP to 127.0.0.1
    const tcpLocal = await checkTcpConnection(hardcodedHost, hardcodedPort);
    
    // Check 2: Raw TCP to Docker Gateway (common fallback)
    const tcpDocker = await checkTcpConnection('172.17.0.1', 3306, 1000);

    if (process.env.DATABASE_URL) {
       // ... processing env url ...
       try {
         const url = new URL(process.env.DATABASE_URL.replace('mysql://', 'http://').replace('postgres://', 'http://'))
         dbUrlInfo = { host: url.hostname, port: url.port ? parseInt(url.port) : 3306 }
         tcpResult = await checkTcpConnection(dbUrlInfo.host, dbUrlInfo.port)
       } catch (e) {}
    }

    // 3. Test Prisma (Race against timeout)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Prisma Connection Timed Out')), 4000)
    )
    
    // We expect this to fail if TCP failed
    const userCountPromise = prisma.user.count()
    let prismaResult = 'Pending'
    
    try {
       await Promise.race([userCountPromise, timeoutPromise])
       prismaResult = 'Success'
    } catch (e: any) {
       prismaResult = `Failed: ${e.message}`
    }

    return NextResponse.json({
      status: 'diagnosis_complete_V2',
      network_check: {
        raw_connection_env: tcpResult,
        raw_connection_localhost: tcpLocal,
        raw_connection_docker: tcpDocker,
      },
      prisma_check: prismaResult,
      env_check: {
        DATABASE_URL_DEFINED: !!process.env.DATABASE_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        ALL_KEYS: Object.keys(process.env).sort().filter(k => k.indexOf('KEY') === -1 && k.indexOf('SECRET') === -1 && k.indexOf('TOKEN') === -1) // Safe dump of keys
      }
    }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({
      status: 'script_error',
      message: error.message
    }, { status: 500 })
  }
}
