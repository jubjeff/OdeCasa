import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const { loja_id, evento, pedido_id } = await req.json()

  const { data: config } = await supabaseAdmin
    .from('webhook_configs')
    .select('url, secret, ativo')
    .eq('loja_id', loja_id)
    .single()

  if (!config || !config.ativo) return NextResponse.json({ ok: true })

  let payload: Record<string, unknown>

  if (evento === 'webhook.teste' || !pedido_id) {
    payload = {
      evento,
      loja_id,
      pedido_id: pedido_id ?? null,
      timestamp: new Date().toISOString(),
      pedido: {
        status: 'recebido',
        total: 49.9,
        nome_cliente: 'Cliente Teste',
        telefone_cliente: '(11) 9 0000-0000',
        endereco_entrega: 'Rua Exemplo, 123 — Centro',
        forma_pagamento: 'pix',
        itens: [{ nome_produto: 'Produto Exemplo', quantidade: 2, subtotal: 49.9 }],
      },
    }
  } else {
    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('*, itens_pedido(nome_produto, quantidade, subtotal)')
      .eq('id', pedido_id)
      .single()

    payload = {
      evento,
      loja_id,
      pedido_id,
      timestamp: new Date().toISOString(),
      pedido: pedido
        ? {
            status: pedido.status,
            total: pedido.total,
            nome_cliente: pedido.nome_cliente,
            telefone_cliente: pedido.telefone_cliente,
            endereco_entrega: pedido.endereco_entrega,
            forma_pagamento: pedido.forma_pagamento,
            itens: (pedido.itens_pedido ?? []).map(
              (i: { nome_produto: string; quantidade: number; subtotal: number }) => ({
                nome_produto: i.nome_produto,
                quantidade: i.quantidade,
                subtotal: i.subtotal,
              }),
            ),
          }
        : null,
    }
  }

  const assinatura = createHmac('sha256', config.secret)
    .update(JSON.stringify(payload))
    .digest('hex')

  let status_http: number | null = null
  let sucesso = false
  let erro: string | null = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OdeCasa-Signature': assinatura,
        'X-OdeCasa-Event': evento,
        'X-OdeCasa-Timestamp': new Date().toISOString(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    status_http = res.status
    sucesso = res.ok
    if (!res.ok) erro = await res.text().catch(() => 'resposta inválida')
  } catch {
    erro = 'timeout ou falha de conexão'
  }

  await supabaseAdmin.from('webhook_logs').insert({
    loja_id,
    evento,
    url: config.url,
    payload,
    status_http,
    sucesso,
    erro,
  })

  return NextResponse.json({ ok: true })
}
