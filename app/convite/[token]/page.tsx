'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { XCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

/* ── Tipos ────────────────────────────────────────── */

interface ConviteRow {
  id: string
  email: string
  papel: string
  status: string
  invite_expires_at: string | null
  loja: { nome: string } | null
}

type Estado = 'carregando' | 'invalido' | 'expirado' | 'valido'

const PAPEL_LABEL: Record<string, string> = {
  gerente: 'Gerente',
  atendente: 'Atendente',
  caixa: 'Operador de caixa',
}

/* ── Wrapper centralizado ─────────────────────────── */

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px] bg-surface rounded-2xl shadow-lg p-8 flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center leading-none">
          <span className="text-3xl font-bold">
            <span className="text-ink">Ôde</span><span className="text-brand-500">Casa</span>
          </span>
          <span className="text-xs font-medium text-ink-mute tracking-wide mt-1">delivery</span>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Página ───────────────────────────────────────── */

export default function PaginaConvite() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [estado, setEstado]           = useState<Estado>('carregando')
  const [convite, setConvite]         = useState<ConviteRow | null>(null)
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null)
  const [logado, setLogado]           = useState(false)
  const [aceitando, setAceitando]     = useState(false)
  const [erroAceitar, setErroAceitar] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const [{ data: conviteData }, { data: { user } }] = await Promise.all([
        supabase
          .from('operadores')
          .select('id, email, papel, status, invite_expires_at, loja:lojas(nome)')
          .eq('invite_token', token)
          .maybeSingle(),
        supabase.auth.getUser(),
      ])

      if (user) {
        setLogado(true)
        setUsuarioEmail(user.email ?? null)
      }

      if (!conviteData) { setEstado('invalido'); return }

      // Supabase tipa o join (loja:lojas) como array; normaliza p/ objeto único.
      const raw = conviteData as unknown as Omit<ConviteRow, 'loja'> & {
        loja: { nome: string } | { nome: string }[] | null
      }
      const row: ConviteRow = {
        ...raw,
        loja: Array.isArray(raw.loja) ? raw.loja[0] ?? null : raw.loja,
      }
      setConvite(row)

      const expirado = !row.invite_expires_at || new Date(row.invite_expires_at) <= new Date()
      if (row.status !== 'pendente' || expirado) { setEstado('expirado'); return }

      setEstado('valido')
    }
    init()
  }, [token])

  async function handleAceitar() {
    setAceitando(true)
    setErroAceitar(null)
    const { error } = await supabase.rpc('aceitar_convite', { p_token: token })
    if (error) {
      setAceitando(false)
      if (error.message.includes('inválido') || error.message.includes('expirado')) {
        setErroAceitar('Este link expirou ou já foi utilizado.')
        setEstado('expirado')
        return
      }
      setErroAceitar('Não foi possível aceitar. Tente novamente.')
      return
    }
    toast.success(`Bem-vindo ao painel de ${convite?.loja?.nome ?? 'a loja'}!`)
    router.push('/painel')
  }

  const nomeLoja = convite?.loja?.nome ?? ''
  const emailBate = usuarioEmail && convite
    ? usuarioEmail.toLowerCase() === convite.email.toLowerCase()
    : false

  /* ── Estados de carregamento / erro ── */

  if (estado === 'carregando') {
    return (
      <Cartao>
        <div className="w-12 h-12 rounded-full bg-line animate-pulse" />
        <div className="flex flex-col gap-2 w-full items-center">
          <div className="h-5 w-48 rounded bg-line animate-pulse" />
          <div className="h-4 w-60 rounded bg-line animate-pulse" />
        </div>
      </Cartao>
    )
  }

  if (estado === 'invalido') {
    return (
      <Cartao>
        <XCircle size={48} strokeWidth={1.5} className="text-danger" />
        <div>
          <h1 className="text-xl font-bold text-ink mb-2">Link inválido</h1>
          <p className="text-sm text-ink-soft leading-relaxed">
            Este link de convite não existe ou já foi utilizado.
          </p>
        </div>
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center min-h-[48px] rounded-md bg-brand-500 text-surface text-sm font-semibold hover:bg-brand-600 active:scale-[.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Ir para a página inicial
        </Link>
      </Cartao>
    )
  }

  if (estado === 'expirado') {
    return (
      <Cartao>
        <Clock size={48} strokeWidth={1.5} className="text-accent" />
        <div>
          <h1 className="text-xl font-bold text-ink mb-2">Convite expirado</h1>
          <p className="text-sm text-ink-soft leading-relaxed">
            Este link expirou. Peça um novo convite ao dono da loja
            {nomeLoja ? <> <span className="font-semibold text-ink">{nomeLoja}</span></> : ''}.
          </p>
        </div>
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center min-h-[48px] rounded-md bg-brand-500 text-surface text-sm font-semibold hover:bg-brand-600 active:scale-[.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Ir para a página inicial
        </Link>
      </Cartao>
    )
  }

  /* ── Token válido ── */

  return (
    <Cartao>
      <CheckCircle size={48} strokeWidth={1.5} className="text-brand-500" />

      <div>
        <h1 className="text-xl font-bold text-ink mb-2">Você foi convidado!</h1>
        <p className="text-sm text-ink-soft leading-relaxed">
          O dono de <span className="font-semibold text-ink">{nomeLoja}</span> convidou você como{' '}
          <span className="font-semibold text-ink">{PAPEL_LABEL[convite?.papel ?? ''] ?? convite?.papel}</span>.
        </p>
      </div>

      {/* Detalhes do convite */}
      <div className="w-full bg-bg rounded-xl border border-line px-4 py-4 text-left space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-ink-mute">E-mail</span>
          <span className="text-sm font-medium text-ink">{convite?.email}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-ink-mute">Papel</span>
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
            {PAPEL_LABEL[convite?.papel ?? ''] ?? convite?.papel}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-ink-mute">Loja</span>
          <span className="text-sm font-medium text-ink">{nomeLoja}</span>
        </div>
      </div>

      {/* CTAs conforme estado de login */}
      {!logado ? (
        <div className="w-full flex flex-col gap-3">
          <Link
            href={`/criar-conta?redirect=${encodeURIComponent(`/convite/${token}`)}`}
            className="w-full inline-flex items-center justify-center min-h-[48px] rounded-md bg-brand-500 text-surface text-sm font-semibold hover:bg-brand-600 active:scale-[.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Criar conta para aceitar
          </Link>
          <Link
            href={`/entrar?redirect=${encodeURIComponent(`/convite/${token}`)}`}
            className="w-full inline-flex items-center justify-center min-h-[48px] rounded-md text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Já tenho conta — fazer login
          </Link>
        </div>
      ) : !emailBate ? (
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-start gap-3 bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 text-left">
            <AlertTriangle size={16} strokeWidth={1.75} className="text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-ink-soft leading-snug">
              Este convite foi enviado para{' '}
              <span className="font-semibold text-ink">{convite?.email}</span>.
              Você está logado como{' '}
              <span className="font-semibold text-ink">{usuarioEmail}</span>.
              Saia e entre com a conta correta.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut()
              router.push(`/entrar?redirect=${encodeURIComponent(`/convite/${token}`)}`)
            }}
          >
            Trocar de conta
          </Button>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-3">
          {erroAceitar && (
            <p className="text-sm text-danger text-center">{erroAceitar}</p>
          )}
          <Button
            variant="primary"
            className="w-full"
            onClick={handleAceitar}
            disabled={aceitando}
          >
            {aceitando ? 'Aceitando…' : 'Aceitar convite e entrar no painel'}
          </Button>
        </div>
      )}
    </Cartao>
  )
}
