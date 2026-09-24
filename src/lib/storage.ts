import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const STORAGE_TYPE = (process.env.STORAGE_TYPE || 'local').trim().toLowerCase()

/**
 * Ensures the storage key is safe and doesn't contain path traversal attempts
 */
function sanitizeKey(key: string): string {
  // Remove any null bytes
  key = key.replace(/\0/g, '')
  // Normalize path and remove leading slashes/dots
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '')
  return normalized
}

/**
 * Gets a safe absolute path for local storage operations
 */
function getSafePath(key: string): string {
  const sanitized = sanitizeKey(key)
  const safePath = path.join(UPLOAD_DIR, sanitized)

  if (!safePath.startsWith(UPLOAD_DIR)) {
    throw new Error('Path traversal detected')
  }

  return safePath
}

// S3 Configuration
const s3Client = STORAGE_TYPE === 's3' ? new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  endpoint: process.env.AWS_ENDPOINT, // For Cloudflare R2 or other S3-compatible
  forcePathStyle: !!process.env.AWS_ENDPOINT,
}) : null

const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME || ''


export async function getFile(storageKey: string): Promise<Buffer | null> {
  try {
    if (STORAGE_TYPE === 's3' && s3Client) {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
      }))
      const byteArray = await response.Body?.transformToByteArray()
      return byteArray ? Buffer.from(byteArray) : null
    } else {
      const filePath = getSafePath(storageKey)
      return await fs.readFile(filePath)
    }
  } catch (error) {
    console.error('Error getting file:', error)
    return null
  }
}

export async function deleteFile(storageKey: string): Promise<boolean> {
  try {
    if (STORAGE_TYPE === 's3' && s3Client) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
      }))
    } else {
      const filePath = getSafePath(storageKey)
      await fs.unlink(filePath)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Content-Disposition de download com o nome ORIGINAL do arquivo, sem deixar
 * o nome injetar no cabeçalho: aspas, barra invertida e caracteres de
 * controle (CR/LF) saem da forma ASCII; o nome completo (acentos, emojis)
 * vai em filename* (RFC 5987), que o navegador prefere.
 */
export function contentDispositionAttachment(originalName: string): string {
  const semControle = originalName.replace(/[\u0000-\u001F\u007F]/g, '')
  const ascii = semControle.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').trim() || 'arquivo'
  const utf8 = encodeURIComponent(semControle).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
}

export async function generatePresignedDownloadUrl(
  storageKey: string,
  originalName: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (STORAGE_TYPE === 's3' && s3Client) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ResponseContentDisposition: contentDispositionAttachment(originalName),
    })
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
  }

  // Local fallback
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required for local storage signing')
  }
  const expires = Date.now() + expiresInSeconds * 1000
  // Full 256-bit HMAC (no truncation) for download link integrity.
  const signature = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET)
    .update(`${storageKey}:${expires}`)
    .digest('hex')

  return `/api/download/file?key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(originalName)}&expires=${expires}&sig=${signature}`
}

export function verifyDownloadSignature(
  storageKey: string,
  expires: string,
  signature: string
): boolean {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required for signature verification')
  }
  const expiresNum = parseInt(expires)
  if (isNaN(expiresNum) || Date.now() > expiresNum) return false

  const expectedSig = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET)
    .update(`${storageKey}:${expiresNum}`)
    .digest('hex')

  // Constant-time comparison to avoid timing side-channels.
  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

const BLOCKED_EXTENSIONS = new Set([
  // Executables / scripts
  'exe', 'bat', 'cmd', 'com', 'msi', 'msix', 'scr', 'pif', 'gadget',
  'vbs', 'vbe', 'js', 'jse', 'mjs', 'cjs', 'ws', 'wsf', 'wsc', 'wsh',
  'ps1', 'psm1', 'psd1', 'reg', 'inf', 'scf', 'lnk', 'jar', 'app',
  'sh', 'bash', 'zsh', 'csh', 'ksh', 'run', 'bin', 'dll', 'so', 'dylib',
  'py', 'pyc', 'rb', 'pl', 'php', 'phtml', 'php3', 'php4', 'php5', 'phar',
  'asp', 'aspx', 'jsp', 'cgi', 'htaccess',
  // Active/markup content that can execute script in a browser context
  'html', 'htm', 'xhtml', 'shtml', 'svg', 'svgz', 'xml', 'xsl', 'xslt',
  'mht', 'mhtml', 'hta', 'swf',
])

export function isFileTypeAllowed(mimeType: string, fileName: string): boolean {
  // Strip null bytes / trailing dots that can defeat extension checks.
  const cleanName = fileName.replace(/\0/g, '').replace(/[. ]+$/g, '')

  // Inspect EVERY dotted segment, not just the last one, to defeat
  // double-extension tricks like "invoice.html.txt" or "x.php.jpg".
  const segments = cleanName.toLowerCase().split('.').slice(1)
  for (const seg of segments) {
    if (BLOCKED_EXTENSIONS.has(seg)) {
      return false
    }
  }

  // Reject dangerous MIME types regardless of file name.
  const blockedMime = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|application\/x-msdownload|application\/x-sh|application\/x-httpd-php|application\/javascript|text\/javascript)/i
  if (mimeType && blockedMime.test(mimeType.trim())) {
    return false
  }

  return true
}

/**
 * Primeiros bytes de um objeto (Range) — para conferir a assinatura de uma
 * mídia depois do upload direto ao S3. Devolve null quando o objeto não existe.
 */
export async function lerInicioDoObjeto(storageKey: string, quantos: number): Promise<Uint8Array | null> {
  try {
    if (STORAGE_TYPE === 's3' && s3Client) {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Range: `bytes=0-${quantos - 1}`,
      }))
      const bytes = await response.Body?.transformToByteArray()
      return bytes ?? null
    }
    const handle = await fs.open(getSafePath(storageKey), 'r')
    try {
      const buffer = Buffer.alloc(quantos)
      const { bytesRead } = await handle.read(buffer, 0, quantos, 0)
      return new Uint8Array(buffer.subarray(0, bytesRead))
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
}

/** Tamanho real de um objeto no armazenamento (null quando não existe). */
export async function tamanhoDoObjeto(storageKey: string): Promise<number | null> {
  try {
    if (STORAGE_TYPE === 's3' && s3Client) {
      const response = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: storageKey }))
      return response.ContentLength ?? null
    }
    const stat = await fs.stat(getSafePath(storageKey))
    return stat.size
  } catch {
    return null
  }
}

export async function checkFileExists(storageKey: string, expectedSize: number): Promise<boolean> {
  const tamanho = await tamanhoDoObjeto(storageKey)
  if (tamanho === null) return false
  if (tamanho !== expectedSize) {
    console.warn(`[CheckFile] tamanho diferente do declarado: esperado ${expectedSize}, no armazenamento ${tamanho}`)
    return false
  }
  return true
}

export async function deleteMultipleFiles(storageKeys: string[]): Promise<boolean> {
  if (!storageKeys.length) return true

  if (STORAGE_TYPE === 's3' && s3Client) {
    try {
      // S3 delete limit is 1000
      const chunkSize = 1000
      for (let i = 0; i < storageKeys.length; i += chunkSize) {
        const chunk = storageKeys.slice(i, i + chunkSize)
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: chunk.map(key => ({ Key: key })),
            Quiet: true
          }
        }))
      }
      return true
    } catch (error) {
      console.error('Error deleting S3 files:', error)
      return false
    }
  } else {
    // Local
    try {
      await Promise.all(
        storageKeys.map(key =>
          fs.unlink(getSafePath(key)).catch(() => console.warn('Failed to delete local file'))
        )
      )
      return true
    } catch {
      return false
    }
  }
}

/**
 * PUT presignado de UM objeto (mídia de fundo). Content-Type e Content-Length
 * entram na assinatura: o S3 recusa um envio com tipo diferente do declarado
 * ou maior/menor do que o tamanho aprovado pelo servidor.
 */
export async function generateSimpleUploadUrl(
  storageKey: string,
  contentType: string,
  sizeBytes: number,
  expiresInSeconds: number = 900
): Promise<string> {
  if (STORAGE_TYPE === 's3' && s3Client) {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ContentType: contentType,
      ContentLength: sizeBytes,
    })
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
  }

  // Local fallback
  return `/api/upload/mock-simple?key=${encodeURIComponent(storageKey)}`
}

export async function generatePresignedViewUrl(
  storageKey: string,
  contentType: string = 'application/octet-stream',
  expiresInSeconds: number = 3600
): Promise<string> {
  if (STORAGE_TYPE === 's3' && s3Client) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ResponseContentDisposition: 'inline',
      ResponseContentType: contentType
    })
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
  }

  // Local fallback
  return `/api/upload/mock-simple?key=${encodeURIComponent(storageKey)}`
}

export async function getPresignedPartUrl(
  storageKey: string,
  uploadId: string,
  partNumber: number,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (STORAGE_TYPE === 's3' && s3Client) {
    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    })
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
  }

  // Local fallback (not really usable for direct multipart, but for consistency)
  return `/api/upload/chunk/mock?key=${encodeURIComponent(storageKey)}&part=${partNumber}`
}
