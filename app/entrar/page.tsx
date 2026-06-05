'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
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
        <Image
          src="/odecasa-logo.png"
          alt="ÔdeCasa"
          width={200}
          height={80}
          style={{ height: 'auto' }}
          className="mx-auto block"
          priority
        />
        <Card bodyClassName="p-8">
          <h1 className="text-[22px] font-bold text-ink mb-1">Entrar</h1>
          <p className="text-sm text-ink-soft mb-6">
            Acesse sua conta para usar seus endereços salvos.
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
