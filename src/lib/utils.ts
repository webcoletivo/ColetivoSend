import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️'
  return '📎'
}

/**
 * Token de compartilhamento — é a única credencial que protege uma transferência.
 *
 * Math.random() não é criptográfico: o gerador do V8 (xorshift128+) tem estado
 * recuperável a partir de algumas saídas observadas, o que permitiria prever
 * tokens de outras transferências. Usa-se o CSPRNG da plataforma
 * (crypto.getRandomValues, disponível no Node 18+ e no navegador).
 */
export function generateShareToken(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const length = 12
  // Descarta bytes acima do maior múltiplo de chars.length para não enviesar
  // as primeiras letras do alfabeto (viés de módulo).
  const limite = Math.floor(256 / chars.length) * chars.length
  let result = ''

  while (result.length < length) {
    const buffer = new Uint8Array(length)
    globalThis.crypto.getRandomValues(buffer)
    for (const byte of buffer) {
      if (byte >= limite) continue
      result += chars.charAt(byte % chars.length)
      if (result.length === length) break
    }
  }

  return result
}

export function getDaysUntilExpiry(expiresAt: Date | string): number {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diff = expiry.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function isExpired(expiresAt: Date | string): boolean {
  return new Date(expiresAt) < new Date()
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Polyfill moved to src/lib/db.ts to ensure global coverage whenever Prisma is used
