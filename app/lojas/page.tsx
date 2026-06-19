'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, MapPin, Truck, Store, SearchX, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/* ── Tipos ───────────────────────────────────────── */

interface Loja {
  id: string
  nome: string
  slug: string
  endereco: string | null
  taxa_entrega: number
  pedido_minimo: number | null
  logo_url: string | null
  tempo_entrega_min: number | null
  avaliacoes_ativas: boolean
}

/* ── Categorias (apenas visual — lojas não têm tipo ainda) ── */

const CATEGORIAS: { emoji: string; label: string }[] = [
  { emoji: '🥬', label: 'Hortifrúti' },
  { emoji: '🍎', label: 'Frutas' },
  { emoji: '🥗', label: 'Orgânicos' },
  { emoji: '🛒', label: 'Mercado' },
  { emoji: '🥖', label: 'Padaria' },
  { emoji: '🥩', label: 'Açougue' },
  { emoji: '🧀', label: 'Frios' },
  { emoji: '🥤', label: 'Bebidas' },
]

/* ── Helpers ─────────────────────────────────────── */

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim()
}

function inicial(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() || '?'
}

/* ── Card de loja ────────────────────────────────── */

function CardLoja({ loja, avaliacao }: { loja: Loja; avaliacao?: { media: number; count: number } }) {
  const entrega =
    loja.taxa_entrega === 0 ? 'Entrega grátis' : `Entrega ${formatarReal(loja.taxa_entrega)}`

  return (
    <Link
      href={`/loja/${loja.slug}`}
      className="group bg-surface rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {/* Topo em degradê verde; logo da loja como avatar (ou inicial no fallback) */}
      <div className="aspect-[5/3] bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
        {loja.logo_url ? (
          <div className="w-20 h-20 rounded-full overflow-hidden bg-surface border-2 border-surface/70 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={loja.logo_url} alt={loja.nome} className="w-full h-full object-cover" />
          </div>
        ) : (
          <span className="text-[44px] font-bold text-surface/90 leading-none select-none">
            {inicial(loja.nome)}
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="text-sm font-semibold text-ink leading-snug truncate">{loja.nome}</p>

        {loja.endereco && (
          <p className="flex items-center gap-1 text-xs text-ink-mute mt-1">
            <MapPin size={12} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{loja.endereco}</span>
          </p>
        )}

        <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap mt-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
            <Truck size={13} strokeWidth={1.75} />
            {entrega}
          </span>
          {loja.tempo_entrega_min != null && (
            <span className="text-xs text-ink-mute">
              · ⏱ {loja.tempo_entrega_min}–{loja.tempo_entrega_min + 15} min
            </span>
          )}
          {loja.pedido_minimo != null && loja.pedido_minimo > 0 && (
            <span className="text-xs text-ink-mute">· mín {formatarReal(loja.pedido_minimo)}</span>
          )}
          {avaliacao && (
            <span className="text-xs font-semibold text-accent">
              ⭐ {avaliacao.media.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function HubLojas() {
  const [lojas, setLojas] = useState<Loja[] | undefined>(undefined)
  const [mediaLojas, setMediaLojas] = useState<Record<string, { media: number; count: number }>>({})
  const [busca, setBusca] = useState('')

  useEffect(() => {
    async function carregar() {
      const [{ data }, { data: avalData }] = await Promise.all([
        supabase
          .from('lojas')
          .select('id, nome, slug, endereco, taxa_entrega, pedido_minimo, logo_url, tempo_entrega_min, avaliacoes_ativas')
          .eq('ativo', true)
          .order('nome', { ascending: true }),
        supabase.from('avaliacoes').select('loja_id, nota'),
      ])
      setLojas((data as Loja[]) ?? [])

      // Agrupa avaliações por loja e computa média (exibe se >= 5)
      if (avalData && avalData.length > 0) {
        const grupos: Record<string, number[]> = {}
        for (const a of avalData as { loja_id: string; nota: number }[]) {
          ;(grupos[a.loja_id] ??= []).push(a.nota)
        }
        const mapa: Record<string, { media: number; count: number }> = {}
        for (const [lojaId, notas] of Object.entries(grupos)) {
          if (notas.length >= 5) {
            mapa[lojaId] = { media: notas.reduce((s, n) => s + n, 0) / notas.length, count: notas.length }
          }
        }
        setMediaLojas(mapa)
      }
    }
    carregar()
  }, [])

  const termo = busca.trim()
  const filtradas = useMemo(() => {
    if (!lojas) return []
    if (!termo) return lojas
    const alvo = normalizar(termo)
    return lojas.filter(l => normalizar(l.nome).includes(alvo))
  }, [lojas, termo])

  const total = lojas?.length ?? 0

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Barra superior ───────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface border-b border-line">
        <div className="max-w-5xl mx-auto px-4">
          <div className="h-14 flex items-center gap-3">
            <Link href="/" aria-label="ÔdeCasa Delivery — início" className="flex flex-col leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
              <span className="text-lg font-bold">
                <span className="text-ink">Ôde</span><span className="text-brand-500">Casa</span>
              </span>
              <span className="text-[11px] font-medium text-ink-mute tracking-wide">delivery</span>
            </Link>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
              aria-label="Localização: Recife"
            >
              <MapPin size={15} strokeWidth={1.75} className="text-brand-500 shrink-0" />
              <span className="font-medium text-ink">Recife</span>
              <ChevronDown size={14} strokeWidth={1.75} className="text-ink-mute" />
            </button>

            {/* Ações à direita */}
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <NotificationBell />
            </div>
          </div>

          {/* Busca */}
          <div className="pb-3">
            <div className="relative">
              <Search
                size={18}
                strokeWidth={1.75}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none"
              />
              <input
                type="search"
                inputMode="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar loja pelo nome"
                aria-label="Buscar loja pelo nome"
                className={[
                  'w-full h-11 rounded-full border border-line bg-bg pl-10 pr-4',
                  'text-sm text-ink placeholder:text-ink-mute',
                  'outline-none transition-shadow duration-150',
                  'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                ].join(' ')}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── Conteúdo ─────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">

        {lojas === undefined ? (
          <p className="text-sm text-ink-mute text-center py-16">Carregando lojas…</p>
        ) : total === 0 ? (
          /* Nenhuma loja ativa cadastrada */
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Store size={44} strokeWidth={1.25} className="text-ink-mute mb-4" />
            <p className="text-base font-semibold text-ink">Nenhuma loja disponível por enquanto</p>
            <p className="text-sm text-ink-soft mt-1">Volte em breve para conferir novidades.</p>
          </div>
        ) : (
          <>
            {/* Banner institucional */}
            <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-5 shadow-md flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[17px] font-bold leading-snug text-surface">
                  Peça do seu hortifrúti favorito
                </p>
                <p className="text-sm text-brand-100 mt-1 leading-snug">
                  Direto da loja do seu bairro, sem comissão.
                </p>
              </div>
              <span className="text-4xl shrink-0" aria-hidden="true">🥬</span>
            </div>

            {/* Fileira de categorias — apenas visual */}
            <div
              className="mt-5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-hidden="true"
            >
              {CATEGORIAS.map(cat => (
                <div key={cat.label} className="shrink-0 flex flex-col items-center gap-1.5 w-16">
                  <div className="w-14 h-14 rounded-full bg-brand-50 border border-line flex items-center justify-center text-2xl select-none">
                    {cat.emoji}
                  </div>
                  <span className="text-xs text-ink-soft text-center leading-tight">{cat.label}</span>
                </div>
              ))}
            </div>

            {/* Vitrine */}
            <h2 className="text-[18px] font-semibold text-ink mt-6 mb-3">
              Lojas em Recife <span className="text-ink-mute font-medium">({total})</span>
            </h2>

            {filtradas.length === 0 ? (
              /* Busca sem resultado */
              <div className="flex flex-col items-center justify-center text-center py-16">
                <SearchX size={44} strokeWidth={1.25} className="text-ink-mute mb-4" />
                <p className="text-base font-semibold text-ink">
                  Nenhuma loja encontrada para “{termo}”
                </p>
                <p className="text-sm text-ink-soft mt-1">Tente buscar por outro nome.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filtradas.map(loja => (
                  <CardLoja key={loja.id} loja={loja} avaliacao={loja.avaliacoes_ativas ? mediaLojas[loja.id] : undefined} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
