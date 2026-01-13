import { test, expect } from '@playwright/test';

test('Critical Flow: Homepage loads and allows navigation', async ({ page }) => {
    // 1. Acessar Home
    await page.goto('/');
    await expect(page).toHaveTitle(/ColetivoSend/);

    // 2. Verificar elementos principais
    // Como não podemos fazer upload real sem backend de storage configurado no ambiente de teste efêmero,
    // verificamos a presença dos componentes vitais.

    const dropzone = page.locator('input[type="file"]');
    await expect(dropzone).toBeAttached();

    await expect(page.getByText('Envie arquivos grandes')).toBeVisible();
});
