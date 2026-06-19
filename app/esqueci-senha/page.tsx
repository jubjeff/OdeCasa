'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { CheckCircle } from 'lucide-react'

export default function EsqueciSenha() {
  const [email, setEmail]         = useState('')
  const [enviado, setEnviado]     = useState(false)
  const [erro, setErro]           = useState<string | null>(null)
  const [enviando, setEnviando]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    const emailLimpo = email.trim()
    if (!emailLimpo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErro('Informe um endereço de e-mail válido.')
      return
    }

    setEnviando(true)

    await supabase.auth.resetPasswordForEmail(emailLimpo, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    // Sempre exibe sucesso, independente do e-mail existir ou não (segurança)
    setEnviando(false)
    setEnviado(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center leading-none mb-6">
          <span className="text-4xl font-bold">
            <span className="text-ink">Ôde</span><span className="text-brand-500">Casa</span>
          </span>
          <span className="text-sm font-medium text-ink-mute tracking-wide mt-1">delivery</span>
        </div>

        <Card bodyClassName="p-8">
          {enviado ? (
            /* ── Estado de sucesso ── */
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
                <CheckCircle size={28} strokeWidth={1.75} className="text-brand-500" />
              </div>
              <h1 className="text-[22px] font-bold text-ink">Link enviado</h1>
              <p className="text-sm text-ink-soft leading-relaxed">
                Se esse e-mail existir em nossa base, você vai receber um link de recuperação em poucos minutos.
              </p>
              <p className="text-xs text-ink-mute mt-1">
                Verifique também a pasta de spam.
              </p>
              <Link
                href="/login"
                className="mt-4 text-sm text-brand-500 font-medium hover:underline"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            /* ── Formulário ── */
            <>
              <h1 className="text-[22px] font-bold text-ink mb-1">Esqueci minha senha</h1>
              <p className="text-sm text-ink-mute mb-6">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="E-mail"
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />

                {erro && <p className="text-sm text-danger">{erro}</p>}

                <Button type="submit" disabled={enviando} className="mt-1 w-full">
                  {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm">
                <Link href="/login" className="text-ink-mute hover:text-brand-500 transition-colors duration-150">
                  Voltar para o login
                </Link>
              </p>
            </>
          )}
        </Card>

      </div>
    </main>
  )
}
