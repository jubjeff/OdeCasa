'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string }

function CriarContaInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/conta'

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState<Mensagem | null>(null)
  const [carregando, setCarregando] = useState(false)

  const linkEntrar = `/entrar?redirect=${encodeURIComponent(redirect)}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setMensagem(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },
        // Após confirmar o e-mail, volta para uma página que loga e
        // redireciona à loja/checkout de origem.
        emailRedirectTo:
          `${window.location.origin}/auth/confirmado?redirect=${encodeURIComponent(redirect)}`,
      },
    })

    if (error) {
      setMensagem({ tipo: 'erro', texto: error.message })
      setCarregando(false)
      return
    }

    // Se o e-mail já entra autenticado (confirmação desativada), volta direto ao fluxo.
    if (data.session) {
      router.push(redirect)
      return
    }

    // Caso contrário, é preciso confirmar o e-mail antes de entrar.
    setMensagem({
      tipo: 'sucesso',
      texto: 'Conta criada! Confirme pelo link no seu e-mail — você volta automaticamente para continuar.',
    })
    setCarregando(false)
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
          <h1 className="text-[22px] font-bold text-ink mb-6">Criar conta</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Nome"
              id="nome"
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              required
            />
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
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              required
            />

            {mensagem && (
              <p
                className={[
                  'text-sm',
                  mensagem.tipo === 'sucesso' ? 'text-brand-600' : 'text-danger',
                ].join(' ')}
              >
                {mensagem.texto}
              </p>
            )}

            <Button type="submit" disabled={carregando} className="mt-1 w-full">
              {carregando ? 'Cadastrando...' : 'Criar conta'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-soft">
            Já tem conta?{' '}
            <Link href={linkEntrar} className="text-brand-500 font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}

export default function CriarConta() {
  return (
    <Suspense fallback={null}>
      <CriarContaInner />
    </Suspense>
  )
}
