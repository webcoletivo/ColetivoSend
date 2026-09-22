import { defineConfig } from '@playwright/test'

/**
 * E2E contra PRODUÇÃO (app.grupocoletivo.com.br/send) com o Chrome instalado
 * na máquina (channel "chrome", nenhum navegador baixado). Mesmo harness da
 * suíte da plataforma (unificacao/e2e): credenciais SÓ por E2E_EMAIL e
 * E2E_SENHA, login único em auth.setup.ts, sessão reaproveitada por
 * storageState (tests/e2e-producao/.auth — ignorado pelo git).
 *
 *   E2E_EMAIL=... E2E_SENHA=... npx playwright test -c playwright.producao.config.ts
 *
 * Cada teste cria no máximo UM envio pequeno "[E2E-AJAX].txt" para o próprio
 * e-mail e o apaga ao final; mídia de teste é uma imagem 1x1, desativada e
 * apagada na sequência. Nada de terceiros, nada de dados reais.
 */
export default defineConfig({
  testDir: './tests/e2e-producao',
  globalTeardown: './tests/e2e-producao/limpeza.ts',
  timeout: 180_000,
  retries: 0,
  workers: 1, // produção real: um fluxo por vez
  reporter: [['list']],
  outputDir: './tests/e2e-producao/resultados',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://app.grupocoletivo.com.br',
    channel: 'chrome',
    viewport: { width: 1600, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    storageState: './tests/e2e-producao/.auth/user.json',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { storageState: { cookies: [], origins: [] } } },
    { name: 'chrome', dependencies: ['setup'] },
  ],
})
