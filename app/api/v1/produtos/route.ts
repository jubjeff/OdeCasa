import { NextRequest, NextResponse } from 'next/server'
import { autenticarApiKey, getSupabaseAdmin } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const auth = await autenticarApiKey(req)
  if (auth instanceof NextResponse) return auth

  const supabaseAdmin = getSupabaseAdmin()
  const { lojaId } = auth
  const { searchParams } = new URL(req.url)

  const disponivel = searchParams.get('disponivel')
  const categoriaId = searchParams.get('categoria_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabaseAdmin
    .from('produtos')
    .select(
      'id, nome, descricao, preco, unidade, disponivel, estoque, criado_em, categorias(id, nome)',
      { count: 'exact' },
    )
    .eq('loja_id', lojaId)
    .order('nome', { ascending: true })
    .range(offset, offset + limit - 1)

  if (disponivel !== null) query = query.eq('disponivel', disponivel === 'true')
  if (categoriaId) query = query.eq('categoria_id', categoriaId)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ data, total: count ?? 0, limit, offset })
}
