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
    if (process.env.DATABASE_URL) {
       try {
         // Handle protocols like mysql:// and postgres://
         const url = new URL(process.env.DATABASE_URL.replace('mysql://', 'http://').replace('postgres://', 'http://'))
         dbUrlInfo = {
            host: url.hostname,
            port: url.port ? parseInt(url.port) : 3306,
            protocol: process.env.DATABASE_URL.split(':')[0]
         }
         
         // 2. Perform Raw TCP Check
        tcpResult = await checkTcpConnection(dbUrlInfo.host, dbUrlInfo.port)
       } catch (e) {
         dbUrlInfo = { error: 'Could not parse URL' }
       }
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
      status: 'diagnosis_complete',
      network_check: {
        target_host: dbUrlInfo?.host,
        target_port: dbUrlInfo?.port,
        raw_connection: tcpResult,
      },
      prisma_check: prismaResult,
      env_check: {
        DATABASE_URL_DEFINED: !!process.env.DATABASE_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL
      }
    }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({
      status: 'script_error',
      message: error.message
    }, { status: 500 })
  }
}
