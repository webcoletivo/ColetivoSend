# FlowSend

Sistema de compartilhamento de arquivos estilo WeTransfer com UI premium.

## Setup

```bash
# Instalar dependências
npm install

# Configurar banco de dados
npm run db:generate
npm run db:push

# Rodar em desenvolvimento
npm run dev
```

## Estrutura

- `/src/app` - Páginas e API routes (Next.js App Router)
- `/src/components` - Componentes reutilizáveis
- `/src/lib` - Utilitários e configurações
- `/prisma` - Schema do banco de dados

## Funcionalidades

- ✅ Upload de arquivos via drag & drop
- ✅ Compartilhamento via link
- ✅ Envio por e-mail
- ✅ Autenticação (email/senha + Google)
- ✅ 2FA com TOTP
- ✅ Dashboard do usuário
- ✅ Proteção por senha
- ✅ Expiração configurável
