import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Token do link público — é a ÚNICA credencial de uma transferência sem senha.
 *
 * 22 caracteres de um alfabeto de 62 (a-z, A-Z, 0-9) = log2(62^22) ≈ 131 bits:
 * não enumerável nem por força bruta distribuída. Amostragem por rejeição
 * (descarta bytes ≥ 248) para não enviesar as primeiras letras (viés de
 * módulo). Tokens antigos, mais curtos, continuam válidos — só a geração muda.
 */
const ALFABETO_TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const TAMANHO_TOKEN = 22

export function generateShareToken(): string {
  const limite = Math.floor(256 / ALFABETO_TOKEN.length) * ALFABETO_TOKEN.length
  let token = ''
  while (token.length < TAMANHO_TOKEN) {
    const bytes = crypto.randomBytes(TAMANHO_TOKEN)
    for (const byte of bytes) {
      if (byte >= limite) continue
      token += ALFABETO_TOKEN[byte % ALFABETO_TOKEN.length]
      if (token.length === TAMANHO_TOKEN) break
    }
  }
  return token
}

/**
 * IP de quem chama, para os limitadores. Atrás do proxy (Traefik/Coolify) o
 * primeiro x-forwarded-for é o cliente; o valor é só uma chave de contagem.
 */
export function ipDoPedido(request: { headers: { get(name: string): string | null } }): string {
  const encaminhado = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = encaminhado || request.headers.get('x-real-ip')?.trim() || ''
  // só o que parece IP (v4/v6) cabe numa chave de rate limit: o resto é lixo do cliente
  const valido = ip.match(/^[0-9a-fA-F.:]{1,45}/)
  return valido ? valido[0] : 'desconhecido'
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

export const USER_LIMITS = FREE_LIMITS // Alias for now

// Re-export from storage for convenience
export { isFileTypeAllowed } from './storage'
