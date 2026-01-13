import { z } from 'zod'
import { USER_LIMITS } from './security'

// Constants for validation
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB (example generic limit, individual limits via config)
const MAX_FILES_COUNT = 50 // Example limit

export const fileSchema = z.object({
    name: z.string().min(1, "Nome do arquivo é obrigatório"),
    type: z.string().default('application/octet-stream'),
    size: z.number().min(1, "Arquivo vazio não permitido").max(MAX_FILE_SIZE, "Arquivo muito grande to upload via validations lib generic limit"),
    storageKey: z.string().min(1, "Storage Key inválida"),
    checksum: z.string().optional().nullable(),
})

export const finalizeTransferSchema = z.object({
    transferId: z.string().uuid("ID de transferência inválido").optional(), // Sometimes frontend might not send uuid if using temp ids differently
    senderName: z.string().min(1, "Seu nome é obrigatório").max(100, "Nome muito longo").trim(),
    recipientEmail: z.string().email("Email do destinatário inválido").optional().nullable().or(z.literal('')),
    message: z.string().max(500, "Mensagem muito longa").optional().nullable(),
    files: z.array(fileSchema).min(1, "Pelo menos um arquivo é necessário").max(MAX_FILES_COUNT, "Muitos arquivos"),
    expirationDays: z.number()
        .refine((val) => USER_LIMITS.expirationOptions.includes(val), {
            message: "Opção de expiração inválida"
        })
        .default(7),
    password: z.string().min(4, "Senha deve ter no mínimo 4 caracteres").optional().nullable().or(z.literal('')),
    fingerprint: z.string().max(255).optional()
})

export const presignUploadSchema = z.object({
    files: z.array(z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        size: z.number().min(1).max(MAX_FILE_SIZE),
        type: z.string()
    })).min(1).max(MAX_FILES_COUNT),
    fingerprint: z.string().max(255).optional()
})
