'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, MapPin, Truck, Store, SearchX } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/* ── Tipos ───────────────────────────────────────── */

interface Loja {
  id: string
  nome: string
  slug: string
  endereco: string | null
  taxa_entrega: number
  pedido_minimo: number | null
}

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

function CardLoja({ loja }: { loja: Loja }) {
  const entrega =
    loja.taxa_entrega === 0 ? 'Entrega grátis' : `Entrega ${formatarReal(loja.taxa_entrega)}`

  return (
    <Link
      href={`/loja/${loja.slug}`}
      className="group bg-surface rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {/* Placeholder visual — degradê verde com a inicial da loja */}
      <div className="aspect-[5/3] bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
        <span className="text-[44px] font-bold text-surface/90 leading-none select-none">
          {inicial(loja.nome)}
        </span>
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
          {loja.pedido_minimo != null && loja.pedido_minimo > 0 && (
            <span className="text-xs text-ink-mute">· mín {formatarReal(loja.pedido_minimo)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function HubLojas() {
  const [lojas, setLojas] = useState<Loja[] | undefined>(undefined)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('lojas')
        .select('id, nome, slug, endereco, taxa_entrega, pedido_minimo')
        .eq('ativo', true)
        .order('nome', { ascending: true })
      setLojas((data as Loja[]) ?? [])
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

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Barra superior ───────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface border-b border-line">
        <div className="max-w-5xl mx-auto px-4">
          <div className="h-14 flex items-center">
            <Image
              src="/odecasa-logo.png"
              alt="ÔdeCasa Delivery"
              width={40}
              height={40}
              className="block shrink-0"
              priority
            />
            <span className="ml-2 text-base font-semibold text-ink">Lojas</span>
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
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5">

        {lojas === undefined ? (
          <p className="text-sm text-ink-mute text-center py-16">Carregando lojas…</p>
        ) : lojas.length === 0 ? (
          // Nenhuma loja ativa cadastrada
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Store size={44} strokeWidth={1.25} className="text-ink-mute mb-4" />
            <p className="text-base font-semibold text-ink">Nenhuma loja disponível por enquanto</p>
            <p className="text-sm text-ink-soft mt-1">Volte em breve para conferir novidades.</p>
          </div>
        ) : filtradas.length === 0 ? (
          // Busca sem resultado
          <div className="flex flex-col items-center justify-center text-center py-20">
            <SearchX size={44} strokeWidth={1.25} className="text-ink-mute mb-4" />
            <p className="text-base font-semibold text-ink">
              Nenhuma loja encontrada para “{termo}”
            </p>
            <p className="text-sm text-ink-soft mt-1">Tente buscar por outro nome.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtradas.map(loja => (
              <CardLoja key={loja.id} loja={loja} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
