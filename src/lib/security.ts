import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

export function generateShareToken(): string {
  // Generate a URL-safe, non-sequential token
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  const randomBytes = crypto.randomBytes(12)
  for (let i = 0; i < 12; i++) {
    token += chars[randomBytes[i] % chars.length]
  }
  return token
}

export function hashFingerprint(fingerprint: string): string {
  return crypto.createHash('sha256').update(fingerprint).digest('hex')
}

export function hashIP(ip: string): string {
  // Hash IP with a salt to prevent rainbow table attacks
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required for security operations')
  }
  return crypto.createHash('sha256').update(ip + process.env.NEXTAUTH_SECRET).digest('hex')
}

export function encryptSecret(secret: string): string {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required for encryption')
  }
  const key = crypto.scryptSync(process.env.NEXTAUTH_SECRET, 'static-salt-for-kdf', 32)
  const iv = crypto.randomBytes(12) // GCM standard IV size is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decryptSecret(encrypted: string): string {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required for decryption')
  }

  const parts = encrypted.split(':')
  if (parts.length < 2) {
    // Fallback for legacy plain text or old CBC format
    // But ideally we should transition away
    return encrypted
  }

  const key = crypto.scryptSync(process.env.NEXTAUTH_SECRET, 'static-salt-for-kdf', 32)

  try {
    if (parts.length === 3) {
      // GCM format: iv:authTag:encrypted
      const [ivHex, authTagHex, encryptedHex] = parts
      const iv = Buffer.from(ivHex, 'hex')
      const authTag = Buffer.from(authTagHex, 'hex')
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } else {
      // Old CBC format: iv:encrypted
      const [ivHex, encryptedHex] = parts
      const iv = Buffer.from(ivHex, 'hex')
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }
  } catch (error) {
    console.warn('Failed to decrypt secret:', error)
    return encrypted
  }
}

export function generateRecoveryCodes(count: number = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
  }
  return codes
}

// Rate limiting helper
export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: Date
}

export function createRateLimitKey(identifier: string, action: string): string {
  return `${action}:${identifier}`
}

// Free Plan Limits (Standard User)
export const FREE_LIMITS = {
  maxFiles: parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_FILES || '2000'),
  maxSizeMB: parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB || '10240'),
  expirationOptions: [
    0.0416, // 1 hour (1/24)
    1,      // 1 day
    7,      // 7 days
    30      // 30 days
  ],
  maxTransfersPer30Days: 45
}

// Limits are now unified since Guest Mode is disabled
export const GUEST_LIMITS = FREE_LIMITS

export const USER_LIMITS = FREE_LIMITS // Alias for now

export function validateFileSize(sizeBytes: number, isLoggedIn: boolean): boolean {
  const maxBytes = (isLoggedIn ? USER_LIMITS.maxSizeMB : GUEST_LIMITS.maxSizeMB) * 1024 * 1024
  return sizeBytes <= maxBytes
}

export function validateFileCount(count: number, isLoggedIn: boolean): boolean {
  const maxFiles = isLoggedIn ? USER_LIMITS.maxFiles : GUEST_LIMITS.maxFiles
  return count <= maxFiles
}

// Re-export from storage for convenience
export { isFileTypeAllowed } from './storage'

// Security headers
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
