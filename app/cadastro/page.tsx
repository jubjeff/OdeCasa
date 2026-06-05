'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string }

export default function Cadastro() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState<Mensagem | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setMensagem(null)

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    })

    if (error) {
      setMensagem({ tipo: 'erro', texto: error.message })
    } else {
      setMensagem({
        tipo: 'sucesso',
        texto: 'Cadastro realizado! Verifique seu e-mail para confirmar a conta.',
      })
    }

    setCarregando(false)
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
          <h1 className="text-[22px] font-bold text-ink mb-6">Criar conta</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Nome"
              id="nome"
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
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
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
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
            <Link href="/login" className="text-brand-500 font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
