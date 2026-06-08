'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

function EntrarInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/conta'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  const linkCriar = `/criar-conta?redirect=${encodeURIComponent(redirect)}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro(error.message)
      setCarregando(false)
    } else {
      router.push(redirect)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center leading-none mb-6">
          <span className="text-4xl font-bold">
            <span className="text-ink">Ôde</span><span className="text-brand-500">Casa</span>
          </span>
          <span className="text-sm font-medium text-ink-mute tracking-wide mt-1">delivery</span>
        </div>
        <Card bodyClassName="p-8">
          <h1 className="text-[22px] font-bold text-ink mb-6">Entrar</h1>

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
            <Input
              label="Senha"
              id="senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />

            {erro && <p className="text-sm text-danger">{erro}</p>}

            <Button type="submit" disabled={carregando} className="mt-1 w-full">
              {carregando ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-soft">
            Não tem conta?{' '}
            <Link href={linkCriar} className="text-brand-500 font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}

export default function Entrar() {
  return (
    <Suspense fallback={null}>
      <EntrarInner />
    </Suspense>
  )
}
