import { NextRequest, NextResponse } from 'next/server'
import { autenticarApiKey, getSupabaseAdmin } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const auth = await autenticarApiKey(req)
  if (auth instanceof NextResponse) return auth

  const supabaseAdmin = getSupabaseAdmin()
  const { lojaId } = auth
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabaseAdmin
    .from('pedidos')
    .select(
      'id, status, total, subtotal, taxa_entrega, nome_cliente, telefone_cliente, endereco_entrega, forma_pagamento, troco_para, observacoes, criado_em, itens_pedido(nome_produto, quantidade, preco_unitario, subtotal, unidade)',
      { count: 'exact' },
    )
    .eq('loja_id', lojaId)
    .order('criado_em', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ data, total: count ?? 0, limit, offset })
}
