'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function ConfirmadoInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/conta'
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let ativo = true
    let unsub: (() => void) | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    async function confirmar() {
      // PKCE: troca o authorization code por sessão explicitamente
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }

      if (!ativo) return

      // Sessão já disponível (implicit flow ou code já trocado)
      const { data: { session } } = await supabase.auth.getSession()
      if (session && ativo) { router.replace(redirect); return }

      // Listener para sessão que pode surgir após o exchange async
      const { data: sub } = supabase.auth.onAuthStateChange((_evento, sess) => {
        if (sess && ativo) router.replace(redirect)
      })
      unsub = () => sub.subscription.unsubscribe()

      // Fallback: após 6s mostra opção de entrar manualmente
      timer = setTimeout(() => { if (ativo) setFalhou(true) }, 6000)
    }

    confirmar()

    return () => {
      ativo = false
      unsub?.()
      if (timer) clearTimeout(timer)
    }
  }, [router, redirect])

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="text-center max-w-xs">
        {falhou ? (
          <>
            <p className="text-base font-semibold text-ink">Não conseguimos confirmar automaticamente</p>
            <p className="text-sm text-ink-soft mt-1 mb-5 leading-relaxed">
              Sua conta pode já estar confirmada. Faça login para continuar.
            </p>
            <Link
              href={
                redirect.startsWith('/painel') || redirect.startsWith('/admin')
                  ? `/login?redirect=${encodeURIComponent(redirect)}`
                  : `/entrar?redirect=${encodeURIComponent(redirect)}`
              }
              className="inline-flex items-center justify-center min-h-[48px] px-5 rounded-md font-semibold text-sm bg-brand-500 text-surface hover:bg-brand-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Entrar
            </Link>
          </>
        ) : (
          <>
            <Loader2 size={32} strokeWidth={1.75} className="text-brand-500 mx-auto mb-4 animate-spin" />
            <p className="text-base font-semibold text-ink">Confirmando sua conta…</p>
            <p className="text-sm text-ink-soft mt-1 leading-relaxed">
              Só um instante, já vamos te levar de volta.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default function Confirmado() {
  return (
    <Suspense fallback={null}>
      <ConfirmadoInner />
    </Suspense>
  )
}
