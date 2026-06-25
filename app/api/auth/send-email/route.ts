import { render } from '@react-email/components'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { ConfirmacaoContaEmail } from '@/lib/email-templates/confirmacao-conta'
import { PasswordResetEmail } from '@/lib/email-templates/password-reset'

const FROM     = 'OdeCasa <noreply@odecasa.store>'
const API_KEY  = process.env.RESEND_API_KEY ?? ''
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

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

function buildVerifyUrl(tokenHash: string, type: string, redirectTo: string) {
  return `${SUPA_URL}/auth/v1/verify?token=${tokenHash}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { user, email_data } = body ?? {}
    const { email_action_type, token_hash, redirect_to, site_url } = email_data ?? {}
    const email = user?.email
    const nome: string = user?.user_metadata?.nome ?? 'Olá'

    if (!email || !token_hash || !email_action_type) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const siteUrl = site_url || process.env.SITE_URL || 'https://odecasa.store'
    const redirectFinal = redirect_to || `${siteUrl}/auth/confirmado`

    if (email_action_type === 'signup') {
      const urlConfirmacao = buildVerifyUrl(token_hash, 'signup', redirectFinal)
      const html = await render(
        React.createElement(ConfirmacaoContaEmail, { nomeDestinatario: nome, urlConfirmacao }),
      )
      await enviar(email, 'Confirme seu e-mail no ÔdeCasa', html)

    } else if (email_action_type === 'recovery') {
      const urlReset = buildVerifyUrl(token_hash, 'recovery', redirectFinal)
      const html = await render(
        React.createElement(PasswordResetEmail, { nomeDestinatario: nome, urlReset, expiraEm: '1 hora' }),
      )
      await enviar(email, 'Redefinição de senha — ÔdeCasa', html)

    } else {
      // email_change, invite, magiclink — deixa o Supabase tratar com template padrão
      return NextResponse.json({ message: 'tipo não tratado, use o template padrão do Supabase' })
    }

    return NextResponse.json({ message: 'ok' })
  } catch (err) {
    console.error('[auth/send-email]', err)
    return NextResponse.json({ error: 'Falha ao enviar e-mail' }, { status: 500 })
  }
}
