import { render } from '@react-email/components'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { getSupabaseAdmin } from '@/lib/apiAuth'
import { OrderConfirmationEmail } from '@/lib/email-templates/order-confirmation'
import { OrderStatusEmail, type StatusNotificavel } from '@/lib/email-templates/order-status'
import { WelcomeEmail } from '@/lib/email-templates/welcome'

const FROM      = 'OdeCasa <noreply@odecasa.store>'
const SITE_URL  = process.env.SITE_URL ?? 'https://odecasa.store'
const API_KEY   = process.env.RESEND_API_KEY ?? ''

async function enviar(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) throw new Error(await res.text())
}

const STATUS_NOTIFICAVEL = new Set<string>(['preparando', 'saiu_entrega', 'entregue'])

const ASSUNTO: Record<StatusNotificavel, string> = {
  preparando:   'Seu pedido está sendo preparado 👨‍🍳',
  saiu_entrega: 'Seu pedido saiu para entrega 🛵',
  entregue:     'Pedido entregue com sucesso 🎉',
}

export async function POST(req: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })

  const body = await req.json()
  const { tipo } = body

  try {
    /* ── Boas-vindas ao lojista ─────────────────────── */
    if (tipo === 'boas_vindas') {
      const { email, nome_dono, nome_loja } = body
      const html = await render(
        React.createElement(WelcomeEmail, {
          nomeDono:  nome_dono,
          nomeLoja:  nome_loja,
          urlPainel: `${SITE_URL}/painel`,
        }),
      )
      await enviar(email, `Bem-vindo ao ÔdeCasa — ${nome_loja} está pronta!`, html)
      return NextResponse.json({ ok: true })
    }

    /* ── Confirmação de pedido (cliente no checkout) ── */
    if (tipo === 'confirmacao') {
      const { email, nome_cliente, nome_loja, pedido_id_curto, itens, taxa_entrega, total, whatsapp } = body
      if (!email) return NextResponse.json({ ok: true, skipped: 'no_email' })

      const html = await render(
        React.createElement(OrderConfirmationEmail, {
          nomeCliente:   nome_cliente,
          nomeLoja:      nome_loja,
          numeroPedido:  pedido_id_curto,
          itens,
          taxaEntrega:   taxa_entrega,
          total,
          urlPedido:     `${SITE_URL}/conta`,
          whatsapp,
        }),
      )
      await enviar(email, `Pedido #${pedido_id_curto} confirmado em ${nome_loja} ✓`, html)
      return NextResponse.json({ ok: true })
    }

    /* ── Atualização de status (painel do lojista) ──── */
    if (tipo === 'status') {
      const { pedido_id, novo_status } = body
      if (!STATUS_NOTIFICAVEL.has(novo_status)) return NextResponse.json({ ok: true, skipped: true })

      const admin = getSupabaseAdmin()

      const { data: pedido } = await admin
        .from('pedidos')
        .select('nome_cliente, cliente_id, loja:lojas(nome, whatsapp)')
        .eq('id', pedido_id)
        .single()

      if (!pedido?.cliente_id) return NextResponse.json({ ok: true, skipped: 'no_cliente_id' })

      const { data: userData } = await admin.auth.admin.getUserById(pedido.cliente_id)
      const email = userData?.user?.email
      if (!email) return NextResponse.json({ ok: true, skipped: 'no_email' })

      const loja = Array.isArray(pedido.loja) ? pedido.loja[0] : pedido.loja

      const html = await render(
        React.createElement(OrderStatusEmail, {
          nomeCliente:  pedido.nome_cliente,
          nomeLoja:     loja?.nome ?? '',
          numeroPedido: pedido_id.slice(0, 8).toUpperCase(),
          statusAtual:  novo_status as StatusNotificavel,
          urlPedido:    `${SITE_URL}/conta`,
          whatsapp:     loja?.whatsapp,
        }),
      )
      await enviar(email, ASSUNTO[novo_status as StatusNotificavel], html)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  } catch (err) {
    console.error('[email/send]', err)
    return NextResponse.json({ error: 'Falha ao enviar e-mail' }, { status: 500 })
  }
}
