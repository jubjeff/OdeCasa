'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShoppingCart, MapPin, Truck, ImageIcon, ShoppingBag, SearchX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'

/* ── Tipos ───────────────────────────────────────── */

interface Loja {
  id: string
  nome: string
  slug: string
  whatsapp: string | null
  endereco: string | null
  taxa_entrega: number
  pedido_minimo: number | null
  ativo: boolean
}

interface Categoria {
  id: string
  loja_id: string
  nome: string
  ordem: number
}

interface Produto {
  id: string
  loja_id: string
  categoria_id: string | null
  nome: string
  descricao: string | null
  preco: number
  unidade: string
  foto_url: string | null
  disponivel: boolean
}

/* ── Helpers ─────────────────────────────────────── */

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const LABEL_UNIDADE: Record<string, string> = {
  un: 'un.', kg: 'kg', g: 'g', maco: 'maço',
  duzia: 'dz.', l: 'L', bandeja: 'bdj.',
}
function labelUnidade(un: string): string {
  return LABEL_UNIDADE[un] ?? un
}

/* filtro: null = todos | 'outros' = sem categoria | uuid = categoria específica */
type Filtro = string | null

interface Secao { id: string; nome: string; itens: Produto[] }

function computarSecoes(cats: Categoria[], prods: Produto[], filtro: Filtro): Secao[] {
  if (filtro === 'outros') {
    const itens = prods.filter(p => !p.categoria_id)
    return itens.length ? [{ id: 'outros', nome: 'Outros', itens }] : []
  }

  const base = filtro ? prods.filter(p => p.categoria_id === filtro) : prods
  const secoes: Secao[] = []

  for (const cat of cats) {
    const itens = base.filter(p => p.categoria_id === cat.id)
    if (itens.length) secoes.push({ id: cat.id, nome: cat.nome, itens })
  }

  // "Outros" só aparece no modo "Todos"
  if (!filtro) {
    const itens = base.filter(p => !p.categoria_id)
    if (itens.length) secoes.push({ id: 'outros', nome: 'Outros', itens })
  }

  return secoes
}

/* ── Card de produto público ─────────────────────── */

function CardProduto({ produto }: { produto: Produto }) {
  return (
    <Card bodyClassName="p-0">
      {/* Foto 4:3 — placeholder verde se sem imagem */}
      <div className="aspect-[4/3] overflow-hidden bg-brand-50">
        {produto.foto_url ? (
          <img
            src={produto.foto_url}
            alt={produto.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} strokeWidth={1.25} className="text-brand-200" />
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="p-3">
        <p className="text-sm font-semibold text-ink leading-snug">
          {produto.nome}
        </p>

        {produto.descricao && (
          <p className="text-xs text-ink-mute mt-1 line-clamp-2 leading-relaxed">
            {produto.descricao}
          </p>
        )}

        <p className="text-[15px] font-bold text-brand-700 mt-2">
          {formatarReal(produto.preco)}
          <span className="text-xs font-normal text-ink-mute">
            {' '}/ {labelUnidade(produto.unidade)}
          </span>
        </p>
      </div>
    </Card>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function PaginaLoja() {
  const { slug } = useParams() as { slug: string }

  const [loja, setLoja]             = useState<Loja | null | undefined>(undefined)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [produtos, setProdutos]     = useState<Produto[]>([])
  const [filtro, setFiltro]         = useState<Filtro>(null)

  useEffect(() => {
    async function init() {
      const { data: lojaData } = await supabase
        .from('lojas')
        .select('*')
        .eq('slug', slug)
        .eq('ativo', true)
        .maybeSingle()

      if (!lojaData) { setLoja(null); return }
      setLoja(lojaData as Loja)

      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase
          .from('categorias')
          .select('*')
          .eq('loja_id', lojaData.id)
          .order('ordem'),
        supabase
          .from('produtos')
          .select('id,loja_id,categoria_id,nome,descricao,preco,unidade,foto_url,disponivel')
          .eq('loja_id', lojaData.id)
          .eq('disponivel', true)
          .order('nome'),
      ])

      setCategorias((cats as Categoria[]) ?? [])
      setProdutos((prods as Produto[]) ?? [])
    }

    init()
  }, [slug])

  /* ── Loading ──────────────────────────────────── */
  if (loja === undefined) return null

  /* ── Loja não encontrada / inativa ───────────── */
  if (loja === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center max-w-xs">
          <SearchX
            size={48}
            strokeWidth={1.25}
            className="text-ink-mute mx-auto mb-4"
          />
          <h1 className="text-[22px] font-bold text-ink">Loja não encontrada</h1>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">
            Verifique o endereço ou peça o link atualizado.
          </p>
        </div>
      </main>
    )
  }

  /* ── Dados derivados ──────────────────────────── */
  const entrega =
    loja.taxa_entrega === 0
      ? 'Entrega grátis'
      : `Entrega ${formatarReal(loja.taxa_entrega)}`

  const catsComProdutos = categorias.filter(c =>
    produtos.some(p => p.categoria_id === c.id)
  )
  const temOutros = produtos.some(p => !p.categoria_id)

  const chips: Array<{ id: Filtro; nome: string }> = [
    { id: null, nome: 'Todos' },
    ...catsComProdutos.map(c => ({ id: c.id, nome: c.nome })),
    ...(temOutros ? [{ id: 'outros' as string, nome: 'Outros' }] : []),
  ]

  const secoes = computarSecoes(categorias, produtos, filtro)

  /* ── Render ───────────────────────────────────── */
  return (
    <div className="min-h-screen bg-bg">

      {/* ── Barra superior fixa ──────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <p className="text-base font-semibold text-ink truncate">{loja.nome}</p>
          <button
            aria-label="Ver carrinho"
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ShoppingCart size={22} strokeWidth={1.75} className="text-ink" />
          </button>
        </div>
      </header>

      {/* Espaçador da barra fixa */}
      <div className="h-14" />

      {/* ── Cabeçalho da loja ────────────────────── */}
      <div className="bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <h1 className="text-[22px] font-bold text-ink">{loja.nome}</h1>

          {loja.endereco && (
            <p className="flex items-start gap-1.5 text-sm text-ink-soft mt-2">
              <MapPin size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              {loja.endereco}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
              <Truck size={14} strokeWidth={1.75} />
              {entrega}
            </span>
            {loja.pedido_minimo != null && loja.pedido_minimo > 0 && (
              <span className="text-sm text-ink-soft">
                Pedido mínimo {formatarReal(loja.pedido_minimo)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Chips de categoria ────────────────────── */}
      {chips.length > 1 && (
        <div className="sticky top-14 z-30 bg-surface border-b border-line">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map(chip => (
                <button
                  key={chip.id ?? 'todos'}
                  onClick={() => setFiltro(chip.id)}
                  className={[
                    'shrink-0 px-4 h-9 rounded-full text-sm font-medium',
                    'transition-colors duration-150 whitespace-nowrap',
                    filtro === chip.id
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-surface border border-line text-ink-soft hover:bg-brand-50',
                  ].join(' ')}
                >
                  {chip.nome}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Conteúdo principal ───────────────────── */}
      <main className="max-w-2xl mx-auto px-4 pb-16">
        {secoes.length === 0 ? (
          /* Estado vazio */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag
              size={48}
              strokeWidth={1.25}
              className="text-ink-mute mb-4"
            />
            <p className="text-base font-semibold text-ink">
              Nenhum produto disponível
            </p>
            <p className="text-sm text-ink-soft mt-1">
              Esta loja ainda não tem produtos.
            </p>
          </div>
        ) : (
          secoes.map(secao => (
            <section
              key={secao.id}
              id={`cat-${secao.id}`}
              className="mt-6 scroll-mt-36"
            >
              <h2 className="text-[18px] font-semibold text-ink mb-3">
                {secao.nome}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {secao.itens.map(p => (
                  <CardProduto key={p.id} produto={p} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
