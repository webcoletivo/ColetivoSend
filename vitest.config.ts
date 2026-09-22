import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'node',
        globals: true,
        exclude: ['tests/e2e/**', 'tests/e2e-producao/**', 'node_modules/**', 'dist/**'],
    },
})
