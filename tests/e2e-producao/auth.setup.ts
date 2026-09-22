import { test as setup, expect, request } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { ESTADO } from './apoio'

/**
 * Login único na plataforma — grava a sessão em .auth/user.json.
 * Se a sessão salva ainda vale (/api/auth/verify = 200), não loga de novo:
 * cada login em produção conta para o freio de força bruta da plataforma.
 */
setup('login central', async ({ page, baseURL }) => {
  if (fs.existsSync(ESTADO)) {
    const api = await request.newContext({ baseURL, storageState: ESTADO })
    try {
      const r = await api.get('/api/auth/verify', { failOnStatusCode: false, timeout: 20_000 })
      if (r.status() === 200) return
    } catch {
      // rede oscilou na sonda: segue para o login normal
    } finally {
      await api.dispose()
    }
  }

  const email = process.env.E2E_EMAIL
  const senha = process.env.E2E_SENHA
  if (!email || !senha) {
    throw new Error('Defina E2E_EMAIL e E2E_SENHA no ambiente antes de rodar.')
  }

  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', senha)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ])
  await expect(page.locator('body')).toContainText(/Bom dia|Boa tarde|Boa noite/)

  fs.mkdirSync(path.dirname(ESTADO), { recursive: true })
  await page.context().storageState({ path: ESTADO })
})
