'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traduzirErroAuth } from '@/lib/auth-errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro(traduzirErroAuth(error.message))
      setCarregando(false)
    } else {
      router.push('/painel')
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
              required
            />
            <Input
              label="Senha"
              id="senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />

            {erro && <p className="text-sm text-danger">{erro}</p>}

            <Button type="submit" disabled={carregando} className="mt-1 w-full">
              {carregando ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link href="/esqueci-senha" className="text-ink-mute hover:text-brand-500 transition-colors duration-150">
              Esqueci minha senha
            </Link>
          </p>

          <p className="mt-3 text-center text-sm text-ink-soft">
            Não tem conta?{' '}
            <Link href="/cadastro" className="text-brand-500 font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
