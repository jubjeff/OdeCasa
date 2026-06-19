import { config } from 'dotenv'
import { resolve } from 'path'

// Carrega .env.test (ou .env.test.local) antes de qualquer teste
config({ path: resolve(import.meta.dirname, '.env.test') })
config({ path: resolve(import.meta.dirname, '.env.test.local'), override: true })
