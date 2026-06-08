'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Star, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 10

interface LojaInfo {
  id: string
  nome: string
  slug: string
  avaliacoes_ativas: boolean
}

interface Avaliacao {
  id: string
  nota: number
  comentario: string | null
  criado_em: string
  perfil_nome: string | null
}

interface Resumo {
  media: number
  total: number
  distribuicao: Record<number, number>
}

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(diff / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  if (dias < 30) return `há ${Math.floor(dias / 7)} sem.`
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('pt-BR', opts)
}

function mascaraNome(nome: string | null | undefined): string {
  if (!nome?.trim()) return 'Cliente anônimo'
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[1].charAt(0)}.`
}

function Estrelas({ nota, size = 16 }: { nota: number; size?: number }) {
  const n = Math.round(nota)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.5}
          className={i <= n ? 'text-accent fill-accent' : 'text-line fill-transparent'}
        />
      ))}
    </div>
  )
}

export default function PaginaAvaliacoes() {
  const { slug } = useParams() as { slug: string }

  const [loja, setLoja] = useState<LojaInfo | null | undefined>(undefined)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [temMais, setTemMais] = useState(false)
  const [offset, setOffset] = useState(0)
  const [lojaId, setLojaId] = useState<string | null>(null)

  async function carregarPagina(id: string, from: number) {
    const { data } = await supabase
      .from('avaliacoes')
      .select('id, nota, comentario, criado_em, profiles(nome)')
      .eq('loja_id', id)
      .order('criado_em', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (!data) return

    const items: Avaliacao[] = (data as Record<string, unknown>[]).map(row => ({
      id: row.id as string,
      nota: row.nota as number,
      comentario: row.comentario as string | null,
      criado_em: row.criado_em as string,
      perfil_nome: (row.profiles as { nome?: string | null } | null)?.nome ?? null,
    }))

    setAvaliacoes(prev => from === 0 ? items : [...prev, ...items])
    setTemMais(items.length === PAGE_SIZE)
    setOffset(from + items.length)
  }

  useEffect(() => {
    let ativo = true

    async function init() {
      const { data: lojaData } = await supabase
        .from('lojas')
        .select('id, nome, slug, avaliacoes_ativas')
        .eq('slug', slug)
        .eq('ativo', true)
        .maybeSingle()

      if (!ativo) return

      if (!lojaData) {
        setLoja(null)
        setCarregando(false)
        return
      }

      setLoja(lojaData as LojaInfo)
      setLojaId(lojaData.id)

      if (!lojaData.avaliacoes_ativas) {
        setCarregando(false)
        return
      }

      const { data: notasData } = await supabase
        .from('avaliacoes')
        .select('nota')
        .eq('loja_id', lojaData.id)

      if (!ativo) return

      if (notasData && notasData.length > 0) {
        const total = notasData.length
        const soma = (notasData as { nota: number }[]).reduce((s, n) => s + n.nota, 0)
        const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        for (const { nota } of notasData as { nota: number }[]) {
          dist[nota] = (dist[nota] ?? 0) + 1
        }
        setResumo({ media: soma / total, total, distribuicao: dist })
      }

      await carregarPagina(lojaData.id, 0)
      if (ativo) setCarregando(false)
    }

    init()
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function handleVerMais() {
    if (!lojaId) return
    setCarregandoMais(true)
    await carregarPagina(lojaId, offset)
    setCarregandoMais(false)
  }

  if (loja === undefined || carregando) return null

  if (loja === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="text-base font-semibold text-ink">Loja não encontrada</p>
      </main>
    )
  }

  const btnSecundario = 'inline-flex items-center justify-center min-h-[44px] px-5 rounded-md border border-line bg-surface text-brand-700 text-sm font-semibold hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
  const btnPrimario   = 'inline-flex items-center justify-center min-h-[44px] px-5 rounded-md bg-brand-500 text-surface text-sm font-semibold hover:bg-brand-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      <header className="sticky top-0 z-30 bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href={`/loja/${slug}`}
            aria-label="Voltar ao cardápio"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={1.75} className="text-ink" />
          </Link>
          <h1 className="text-base font-semibold text-ink truncate">Avaliações — {loja.nome}</h1>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

          {!loja.avaliacoes_ativas ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
              <Star size={44} strokeWidth={1.25} className="text-ink-mute" />
              <p className="text-base font-semibold text-ink">
                Esta loja não exibe avaliações no momento.
              </p>
              <Link href={`/loja/${slug}`} className={btnSecundario}>
                Ver cardápio
              </Link>
            </div>

          ) : resumo === null && avaliacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
              <ShoppingBag size={44} strokeWidth={1.25} className="text-ink-mute" />
              <div>
                <p className="text-base font-semibold text-ink">Ainda sem avaliações</p>
                <p className="text-sm text-ink-soft mt-1">Seja o primeiro a avaliar!</p>
              </div>
              <Link href={`/loja/${slug}`} className={btnPrimario}>
                Fazer um pedido
              </Link>
            </div>

          ) : (
            <>
              {resumo && resumo.total >= 5 ? (
                <div className="bg-surface rounded-xl shadow-sm p-5 flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col items-center justify-center sm:border-r sm:border-line sm:pr-5 shrink-0">
                    <span className="text-5xl font-bold text-ink leading-none">
                      {resumo.media.toFixed(1)}
                    </span>
                    <Estrelas nota={resumo.media} size={20} />
                    <span className="text-xs text-ink-mute mt-1.5">
                      {resumo.total} {resumo.total === 1 ? 'avaliação' : 'avaliações'}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 justify-center">
                    {[5, 4, 3, 2, 1].map(n => {
                      const count = resumo.distribuicao[n] ?? 0
                      const pct = resumo.total > 0 ? (count / resumo.total) * 100 : 0
                      return (
                        <div key={n} className="flex items-center gap-2">
                          <span className="text-xs text-ink-soft w-2.5 text-right shrink-0">{n}</span>
                          <Star size={11} strokeWidth={1.5} className="text-accent fill-accent shrink-0" />
                          <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink-mute w-7 text-right shrink-0">
                            {Math.round(pct)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : resumo && resumo.total > 0 ? (
                <div className="bg-surface rounded-xl shadow-sm px-5 py-4 text-center">
                  <p className="text-sm text-ink-soft">Ainda poucas avaliações para exibir a média.</p>
                  <p className="text-xs text-ink-mute mt-0.5">
                    {resumo.total} de 5 necessárias.
                  </p>
                </div>
              ) : null}

              {avaliacoes.length > 0 && (
                <div className="bg-surface rounded-xl shadow-sm px-5">
                  {avaliacoes.map(av => (
                    <div key={av.id} className="py-4 border-b border-line last:border-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Estrelas nota={av.nota} size={14} />
                          <span className="text-xs text-ink-mute shrink-0">
                            {tempoRelativo(av.criado_em)}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-ink-soft truncate shrink-0">
                          {mascaraNome(av.perfil_nome)}
                        </span>
                      </div>
                      {av.comentario && (
                        <p className="text-sm text-ink-soft leading-relaxed mt-2">
                          {av.comentario}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {temMais && (
                <button
                  onClick={handleVerMais}
                  disabled={carregandoMais}
                  className="w-full min-h-[44px] rounded-md border border-line bg-surface text-brand-700 text-sm font-semibold hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
                >
                  {carregandoMais ? 'Carregando…' : 'Ver mais avaliações'}
                </button>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
