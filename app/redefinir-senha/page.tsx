'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traduzirErroAuth } from '@/lib/auth-errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { toast } from 'sonner'
import { AlertCircle, Loader2 } from 'lucide-react'

type Estado = 'verificando' | 'pronto' | 'expirado'

export default function RedefinirSenha() {
  const router = useRouter()
  const [estado, setEstado]       = useState<Estado>('verificando')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro]           = useState<string | null>(null)
  const [salvando, setSalvando]   = useState(false)

  useEffect(() => {
    // O cliente Supabase processa o hash da URL (#access_token=...&type=recovery)
    // e dispara o evento PASSWORD_RECOVERY automaticamente.
    const timer = setTimeout(() => {
      // Se o evento não chegou em 3 s, o link é inválido ou já foi usado.
      setEstado(prev => prev === 'verificando' ? 'expirado' : prev)
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timer)
        setEstado('pronto')
      }
    })

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })

    if (error) {
      setErro(traduzirErroAuth(error.message))
      setSalvando(false)
    } else {
      toast.success('Senha alterada com sucesso!')
      await supabase.auth.signOut()
      router.push('/login')
    }
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

          {/* ── Verificando ── */}
          {estado === 'verificando' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={32} strokeWidth={1.75} className="text-brand-500 animate-spin" />
              <p className="text-sm text-ink-mute">Verificando link…</p>
            </div>
          )}

          {/* ── Link expirado / inválido ── */}
          {estado === 'expirado' && (
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
                <AlertCircle size={28} strokeWidth={1.75} className="text-danger" />
              </div>
              <h1 className="text-[20px] font-bold text-ink">Link inválido ou expirado</h1>
              <p className="text-sm text-ink-soft leading-relaxed">
                Este link expirou ou já foi utilizado. Solicite um novo para redefinir sua senha.
              </p>
              <Link href="/esqueci-senha">
                <Button className="mt-2 w-full">Solicitar novo link</Button>
              </Link>
              <Link href="/login" className="text-sm text-ink-mute hover:text-brand-500 transition-colors duration-150">
                Voltar para o login
              </Link>
            </div>
          )}

          {/* ── Formulário ── */}
          {estado === 'pronto' && (
            <>
              <h1 className="text-[22px] font-bold text-ink mb-1">Nova senha</h1>
              <p className="text-sm text-ink-mute mb-6">
                Escolha uma nova senha para sua conta.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Nova senha"
                  id="nova-senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <Input
                  label="Confirmar nova senha"
                  id="confirmar-senha"
                  type="password"
                  placeholder="••••••••"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                  required
                />

                {erro && <p className="text-sm text-danger">{erro}</p>}

                <Button type="submit" disabled={salvando} className="mt-1 w-full">
                  {salvando ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </form>
            </>
          )}

        </Card>
      </div>
    </main>
  )
}
