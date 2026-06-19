'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePlan } from '@/hooks/usePlan'

/* ── Constantes ──────────────────────────────────────── */

const ADMIN_WHATSAPP = '5581996393807'

const FEATURE_LABELS: Record<string, string> = {
  pedidos_ilimitados:   'Pedidos ilimitados',
  relatorios:           'Relatórios avançados',
  multiplos_operadores: 'Múltiplos operadores',
  integracoes:          'Integrações',
  suporte_prioritario:  'Suporte prioritário',
}

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]

/* ── Tipos ───────────────────────────────────────────── */

interface Plano {
  id: string
  nome: string
  preco_mensal: number
  limite_pedidos_mes: number | null
  features: Record<string, boolean>
}

export interface UpgradeSheetProps {
  feature?: string
  open: boolean
  onClose: () => void
}

/* ── UpgradeSheet ────────────────────────────────────── */

export function UpgradeSheet({ feature, open, onClose }: UpgradeSheetProps) {
  const router = useRouter()
  const { plano: planoAtual } = usePlan()
  const [planos, setPlanos]   = useState<Plano[]>([])
  const [visivel, setVisivel] = useState(false)   // controla animação
  const overlayRef            = useRef<HTMLDivElement>(null)

  const [carregando, setCarregando] = useState(true)

  /* Busca planos uma vez */
  useEffect(() => {
    supabase
      .from('planos')
      .select('*')
      .order('preco_mensal')
      .then(({ data }) => {
        setPlanos((data as Plano[]) ?? [])
        setCarregando(false)
      })
  }, [])

  /* Animação de entrada/saída */
  useEffect(() => {
    if (open) {
      // Força reflow para a transição funcionar
      requestAnimationFrame(() => setVisivel(true))
      document.body.style.overflow = 'hidden'
    } else {
      setVisivel(false)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  /* ESC fecha */
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open && !visivel) return null

  /* Plano mais barato que contém a feature solicitada */
  const planoRecomendado = feature
    ? planos.find(p => p.features[feature] === true && p.id !== planoAtual.id)
    : null

  /* Textos do cabeçalho */
  const featureLabel = feature ? (FEATURE_LABELS[feature] ?? feature) : null
  const titulo = featureLabel
    ? `Desbloqueie ${featureLabel}`
    : 'Faça upgrade do seu plano'

  function handleVerDetalhes() {
    onClose()
    router.push('/painel/planos')
  }

  return (
    /* Backdrop */
    <div
      ref={overlayRef}
      className={[
        'fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end',
        'transition-colors duration-200',
        visivel ? 'bg-ink/40' : 'bg-transparent',
      ].join(' ')}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      {/* Painel */}
      <div
        className={[
          // Mobile: sobe do fundo | Desktop: entra pela direita
          'relative bg-surface flex flex-col',
          'w-full md:w-[420px] md:h-full',
          'rounded-t-2xl md:rounded-none md:rounded-l-2xl',
          'shadow-lg max-h-[92dvh] md:max-h-full',
          'transition-transform duration-200 ease-out',
          visivel
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-x-full',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-ink leading-snug">{titulo}</h2>
            <p className="text-sm text-ink-soft mt-0.5">
              Escolha um plano para continuar crescendo.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0 ml-3 mt-0.5"
          >
            <X size={18} strokeWidth={1.75} className="text-ink-soft" />
          </button>
        </div>

        {/* Cards de planos */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-3">
          {carregando ? (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-line p-4 flex flex-col gap-3 animate-pulse">
                  <div className="h-4 w-24 rounded bg-line" />
                  <div className="h-7 w-20 rounded bg-line" />
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map(j => (
                      <div key={j} className="h-3 w-full rounded bg-line" />
                    ))}
                  </div>
                  <div className="h-10 w-full rounded-md bg-line" />
                </div>
              ))}
            </>
          ) : planos.map(plano => {
            const isAtual       = plano.id === planoAtual.id
            const isRecomendado = plano.id === planoRecomendado?.id
            const isAbaixoAtual = planoAtual.preco_mensal > 0 && plano.preco_mensal < planoAtual.preco_mensal
            const waText        = encodeURIComponent(`Quero fazer upgrade para o plano ${plano.nome}`)
            const waLink        = `https://wa.me/${ADMIN_WHATSAPP}?text=${waText}`

            return (
              <div
                key={plano.id}
                className={[
                  'relative rounded-xl p-4 transition-opacity duration-150',
                  isAtual || isRecomendado
                    ? 'border-2 border-brand-500 bg-surface'
                    : 'border border-line bg-surface',
                  isAbaixoAtual ? 'opacity-50' : '',
                ].join(' ')}
              >
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-semibold text-ink">{plano.nome}</span>
                  </div>
                  {isAtual && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      <Check size={10} strokeWidth={2.5} />
                      Atual
                    </span>
                  )}
                  {isRecomendado && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-semibold text-surface">
                      <Zap size={10} strokeWidth={2.5} />
                      Recomendado
                    </span>
                  )}
                </div>

                {/* Preço */}
                <p className="text-2xl font-bold text-brand-700 mb-3">
                  {plano.preco_mensal === 0
                    ? 'Grátis'
                    : <>R$ {plano.preco_mensal}<span className="text-sm font-normal text-ink-mute">/mês</span></>
                  }
                </p>

                {/* Features */}
                <ul className="flex flex-col gap-1.5 mb-4">
                  {FEATURE_KEYS.map(key => {
                    const inclusa = plano.features[key]
                    const isTarget = key === feature
                    return (
                      <li
                        key={key}
                        className={`flex items-center gap-2 text-sm ${isTarget && inclusa ? 'font-semibold' : ''}`}
                      >
                        {inclusa ? (
                          <span className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                            <Check size={10} strokeWidth={2.5} className="text-brand-600" />
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-line flex items-center justify-center shrink-0">
                            <X size={10} strokeWidth={2} className="text-ink-mute" />
                          </span>
                        )}
                        <span className={inclusa ? 'text-ink' : 'text-ink-mute'}>
                          {FEATURE_LABELS[key]}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
                {isAtual ? (
                  <button
                    disabled
                    className="w-full min-h-[40px] rounded-md bg-brand-50 text-brand-700 text-sm font-semibold border border-brand-200 cursor-default"
                  >
                    Plano atual
                  </button>
                ) : (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center min-h-[40px] rounded-md bg-brand-500 text-surface text-sm font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    Fazer upgrade →
                  </a>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-4 border-t border-line shrink-0 flex flex-col gap-2">
          <button
            onClick={handleVerDetalhes}
            className="w-full min-h-[44px] rounded-md text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Ver detalhes completos →
          </button>
          <p className="text-xs text-ink-mute text-center leading-snug">
            Upgrade manual — nosso time atualiza em até 24h.
          </p>
        </div>
      </div>
    </div>
  )
}
