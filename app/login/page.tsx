'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
      setErro(error.message)
      setCarregando(false)
    } else {
      router.push('/painel')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
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

          <p className="mt-5 text-center text-sm text-ink-soft">
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
