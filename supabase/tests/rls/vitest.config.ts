import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Cada arquivo de teste roda em sequência (banco compartilhado)
    fileParallelism: false,
    // Testes DENTRO do arquivo também em sequência (evita race condition de estado)
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 90_000,
    env: {
      // dotenv não é carregado automaticamente no Vitest — passamos aqui
    },
    setupFiles: ['./vitest.setup.ts'],
  },
})
