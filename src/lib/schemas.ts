import { z } from 'zod'
import { USER_LIMITS } from './security'

/** Limites por arquivo e por envio (os limites por usuário ficam em USER_LIMITS). */
export const MAX_FILE_SIZE = USER_LIMITS.maxSizeMB * 1024 * 1024
export const MAX_FILES_COUNT = 80 // Limite de arquivos por transferência

/** Nome de arquivo aceito: sem separador de caminho, sem controle, até 255 caracteres. */
export const nomeDeArquivoSchema = z.string()
    .min(1, 'Nome do arquivo é obrigatório')
    .max(255, 'Nome do arquivo muito longo')
    .refine((v) => !/[\u0000-\u001F\u007F/\\]/.test(v), 'Nome de arquivo inválido')
    .refine((v) => v.trim() !== '' && v !== '.' && v !== '..', 'Nome de arquivo inválido')

export const fileSchema = z.object({
    name: nomeDeArquivoSchema,
    type: z.string().max(255).default('application/octet-stream'),
    size: z.number().int().min(1, 'Arquivo vazio não permitido').max(MAX_FILE_SIZE, 'Arquivo muito grande'),
    storageKey: z.string().min(1, 'Storage Key inválida').max(1024),
    checksum: z.string().max(128).optional().nullable(),
})

export const finalizeTransferSchema = z.object({
    transferId: z.string().uuid('ID de transferência inválido'),
    senderName: z.string().min(1, 'Seu nome é obrigatório').max(100, 'Nome muito longo').trim(),
    recipientEmail: z.string()
        .max(2000)
        .optional()
        .nullable()
        .refine(
            (val) => {
                if (!val) return true
                const lista = val.split(',').map(e => e.trim()).filter(Boolean)
                return lista.length <= 20 && lista.every(e => z.string().email().max(254).safeParse(e).success)
            },
            { message: 'Email(s) do destinatário inválido(s)' }
        )
        .or(z.literal('')),
    message: z.string().max(500, 'Mensagem muito longa').optional().nullable(),
    files: z.array(fileSchema).min(1, 'Pelo menos um arquivo é necessário').max(MAX_FILES_COUNT, 'Muitos arquivos'),
    expirationDays: z.number()
        .refine((val) => USER_LIMITS.expirationOptions.includes(val), {
            message: 'Opção de expiração inválida'
        })
        .default(7),
    password: z.string().min(4, 'Senha deve ter no mínimo 4 caracteres').max(128).optional().nullable().or(z.literal('')),
})

/** Início de upload em partes (um por arquivo). */
export const initUploadSchema = z.object({
    transferId: z.string().uuid('ID de transferência inválido'),
    fileId: z.string().uuid('ID de arquivo inválido'),
    fileName: nomeDeArquivoSchema,
    fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
    mimeType: z.string().max(255),
})
