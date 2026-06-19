'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePlan } from '@/hooks/usePlan'
import { PageContainer } from '@/components/ui/PageContainer'

/* ── Número do admin para WhatsApp ─────────────────── */
const ADMIN_WHATSAPP = '5581996393807'

/* ── Tipos ──────────────────────────────────────────── */

interface Plano {
  id: string
  nome: string
  preco_mensal: number
  limite_pedidos_mes: number | null
  features: {
    pedidos_ilimitados: boolean
    relatorios: boolean
    multiplos_operadores: boolean
    integracoes: boolean
    suporte_prioritario: boolean
  }
}

const FEATURE_LABELS: { key: keyof Plano['features']; label: string }[] = [
  { key: 'pedidos_ilimitados',   label: 'Pedidos ilimitados' },
  { key: 'relatorios',           label: 'Relatórios avançados' },
  { key: 'multiplos_operadores', label: 'Múltiplos operadores' },
  { key: 'integracoes',          label: 'Integrações' },
  { key: 'suporte_prioritario',  label: 'Suporte prioritário' },
]

/* ── Card de plano ──────────────────────────────────── */

function PlanoCard({
  plano,
  isAtual,
  isPopular,
}: {
  plano: Plano
  isAtual: boolean
  isPopular: boolean
}) {
  const waText = encodeURIComponent(`Quero fazer upgrade para o plano ${plano.nome}`)
  const waLink = `https://wa.me/${ADMIN_WHATSAPP}?text=${waText}`

  return (
    <div
      className={[
        'relative flex flex-col rounded-xl bg-surface p-6',
        'shadow-sm transition-shadow duration-200 hover:shadow-md',
        isAtual
          ? 'border-2 border-brand-500'
          : 'border border-line',
      ].join(' ')}
    >
      {/* Badges posicionados no topo */}
      <div className="absolute -top-3 left-4 flex gap-2">
        {isAtual && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-0.5 text-[11px] font-semibold text-surface">
            <Check size={11} strokeWidth={2.5} />
            Seu plano atual
          </span>
        )}
        {isPopular && !isAtual && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-0.5 text-[11px] font-semibold text-surface">
            <Zap size={11} strokeWidth={2.5} />
            Mais popular
          </span>
        )}
      </div>

      {/* Header: nome + preço */}
      <div className="mb-5 mt-2">
        <h2 className="text-lg font-semibold text-ink">{plano.nome}</h2>
        {plano.preco_mensal === 0 ? (
          <p className="mt-1 text-3xl font-bold text-brand-700">Grátis</p>
        ) : (
          <p className="mt-1 text-3xl font-bold text-brand-700">
            R$ {plano.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            <span className="text-base font-normal text-ink-mute">/mês</span>
          </p>
        )}
      </div>

      {/* Lista de features */}
      <ul className="flex flex-col gap-2.5 flex-1 mb-6">
        {FEATURE_LABELS.map(({ key, label }) => {
          const inclusa = plano.features[key]
          return (
            <li key={key} className="flex items-center gap-2.5">
              {inclusa ? (
                <span className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={2.5} className="text-brand-600" />
                </span>
              ) : (
                <span className="w-5 h-5 rounded-full bg-line flex items-center justify-center shrink-0">
                  <X size={12} strokeWidth={2} className="text-ink-mute" />
                </span>
              )}
              <span className={`text-sm ${inclusa ? 'text-ink' : 'text-ink-mute'}`}>
                {label}
              </span>
            </li>
          )
        })}
      </ul>

      {/* CTA */}
      {isAtual ? (
        <button
          disabled
          className="w-full min-h-[48px] rounded-md bg-brand-50 text-brand-700 text-sm font-semibold border border-brand-200 cursor-default"
        >
          Plano atual
        </button>
      ) : (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[48px] rounded-md bg-brand-500 text-surface text-sm font-semibold flex items-center justify-center hover:bg-brand-600 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Fazer upgrade
        </a>
      )}
    </div>
  )
}

/* ── Barra de uso do mês ────────────────────────────── */

function UsoMensal() {
  const { usoMes, isNearLimit, isLimitReached } = usePlan()
  const { count, limite, percentual } = usoMes

  if (limite === null) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-brand-50 border border-brand-200 px-5 py-4">
        <span className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
          <Check size={14} strokeWidth={2.5} className="text-brand-600" />
        </span>
        <p className="text-sm font-medium text-brand-700">Pedidos ilimitados este mês</p>
      </div>
    )
  }

  const corBarra = isLimitReached()
    ? 'bg-danger'
    : isNearLimit()
      ? 'bg-accent'
      : 'bg-brand-500'

  const corTexto = isLimitReached()
    ? 'text-danger'
    : isNearLimit()
      ? 'text-accent'
      : 'text-ink-soft'

  return (
    <div className="rounded-xl bg-surface border border-line px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Uso este mês</p>
        <p className={`text-sm font-semibold ${corTexto}`}>
          {count} de {limite} pedidos
        </p>
      </div>
      <div className="h-2 rounded-full bg-line overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${corBarra}`}
          style={{ width: `${percentual}%` }}
        />
      </div>
      {isLimitReached() && (
        <p className="text-xs text-danger">
          Limite atingido — faça upgrade para continuar recebendo pedidos.
        </p>
      )}
      {!isLimitReached() && isNearLimit() && (
        <p className="text-xs text-ink-soft">
          Você está próximo do limite — considere fazer upgrade.
        </p>
      )}
    </div>
  )
}

/* ── Página ─────────────────────────────────────────── */

export default function PlanosPage() {
  const router = useRouter()
  const { plano: planoAtual, isLoading: planLoading } = usePlan()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function verificarSessao() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
    }
    verificarSessao()
  }, [router])

  useEffect(() => {
    async function buscarPlanos() {
      const { data } = await supabase
        .from('planos')
        .select('*')
        .order('preco_mensal')
      setPlanos((data as Plano[]) ?? [])
      setLoading(false)
    }
    buscarPlanos()
  }, [])

  if (loading || planLoading) {
    return (
      <main className="py-8">
        <PageContainer size="wide" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="h-8 w-64 rounded-lg bg-line animate-pulse" />
            <div className="h-5 w-80 rounded-lg bg-line animate-pulse mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 rounded-xl bg-line animate-pulse" />
            ))}
          </div>
        </PageContainer>
      </main>
    )
  }

  return (
    <main className="py-8">
      <PageContainer size="wide" className="flex flex-col gap-8">

        {/* Cabeçalho */}
        <div>
          <h1 className="text-2xl font-bold text-ink">Escolha seu plano</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Mensalidade fixa. Sem comissão por pedido.
          </p>
        </div>

        {/* Grade de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3">
          {planos.map(plano => (
            <PlanoCard
              key={plano.id}
              plano={plano}
              isAtual={plano.id === planoAtual.id}
              isPopular={plano.id === 'crescimento'}
            />
          ))}
        </div>

        {/* Uso do mês */}
        <UsoMensal />

        {/* Rodapé */}
        <p className="text-xs text-ink-mute">
          * Upgrade manual — nosso time atualiza seu plano em até 24h após o pagamento via Pix.
        </p>

      </PageContainer>
    </main>
  )
}
