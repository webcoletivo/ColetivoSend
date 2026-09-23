# syntax=docker/dockerfile:1.7
# Três estágios (deps → builder → runner) com saída "standalone" do Next,
# no molde do ColetivoKadro. Substitui o nixpacks (imagem com a nix store
# inteira; exportar as camadas levava minutos).

FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_BASE_PATH=/send
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
# Só para páginas que consultam o banco na geração estática; fica neste
# estágio — não vai para a imagem final.
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
# "build" = prisma generate && next build
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# Só 5xx ou conexão recusada contam como falha (o middleware pode responder
# 401/404 a caminhos sem sessão sem que o processo esteja doente).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \n  CMD node -e "fetch('http://127.0.0.1:3000/send/api/health').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
