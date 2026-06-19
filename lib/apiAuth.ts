import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Client admin (service role) criado sob demanda. A inicialização é lazy de
 * propósito: se fosse no escopo do módulo, o `next build` avaliaria este
 * arquivo durante a coleta de dados e exigiria a SERVICE_ROLE_KEY em build —
 * que é segredo de runtime, não de build. Compartilhado entre as rotas de API.
 */
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _supabaseAdmin
}

// Rate limit: 60 req/min por loja (Map em memória, reseta por janela de 1 min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(lojaId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(lojaId)
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(lojaId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function autenticarApiKey(
  req: NextRequest,
): Promise<{ lojaId: string } | NextResponse> {
  const supabaseAdmin = getSupabaseAdmin()
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''

  if (!token) {
    return NextResponse.json({ error: 'Authorization header ausente' }, { status: 401 })
  }

  const hash = await sha256Hex(token)

  const { data: apiKey } = await supabaseAdmin
    .from('api_keys')
    .select('id, loja_id')
    .eq('key_hash', hash)
    .maybeSingle()

  if (!apiKey) {
    return NextResponse.json({ error: 'API key inválida' }, { status: 401 })
  }

  // Atualiza ultimo_uso sem bloquear a resposta
  supabaseAdmin
    .from('api_keys')
    .update({ ultimo_uso: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {})

  if (!checkRateLimit(apiKey.loja_id)) {
    return NextResponse.json(
      { error: 'Rate limit excedido — máximo 60 req/min' },
      { status: 429 },
    )
  }

  return { lojaId: apiKey.loja_id }
}
