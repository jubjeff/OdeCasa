'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ShoppingCart, MapPin, Truck, ImageIcon, ShoppingBag, SearchX, Search,
  Minus, Plus, X, AlertCircle, ArrowLeft, CheckCircle2, Copy, Check, User, Bell,
  MessageCircle, Star, ExternalLink, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TopBar } from '@/components/ui/TopBar'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Chip } from '@/components/ui/Chip'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/* ── Tipos ───────────────────────────────────────── */

interface FaixaEntrega {
  distancia_ate: number
  taxa: number
}

interface Loja {
  id: string
  nome: string
  slug: string
  whatsapp: string | null
  endereco: string | null
  taxa_entrega: number
  pedido_minimo: number | null
  ativo: boolean
  logo_url: string | null
  chave_pix: string | null
  horarios: Record<string, { aberto: boolean; abre: string; fecha: string }> | null
  tempo_entrega_min: number | null
  avaliacoes_ativas: boolean
  latitude: number | null
  longitude: number | null
  raio_maximo_km: number | null
  faixas_entrega: FaixaEntrega[] | null
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
  preco_original: number | null
  unidade: string
  foto_url: string | null
  disponivel: boolean
  criado_em: string | null
}

interface ItemCarrinho {
  id: string
  nome: string
  preco: number
  unidade: string
  foto_url: string | null
  quantidade: number
}

interface Cliente {
  id: string
  nome: string
  email: string
}

interface Endereco {
  id: string
  cliente_id: string
  apelido: string | null
  endereco: string
  complemento: string | null
  referencia: string | null
  cep: string | null
  padrao: boolean
  criado_em: string
}

type AcaoCarrinho =
  | { type: 'ADICIONAR'; produto: Produto }
  | { type: 'ADICIONAR_ITENS'; itens: { produto: Produto; quantidade: number }[] }
  | { type: 'INCREMENTAR'; id: string; unidade: string }
  | { type: 'DECREMENTAR'; id: string; unidade: string }
  | { type: 'REMOVER'; id: string }
  | { type: 'LIMPAR' }

type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_entrega'
type Etapa = 'loja' | 'checkout' | 'confirmacao'

interface FormCheckout {
  nome: string
  telefone: string
  cep: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  referencia: string
  observacoes: string
  forma_pagamento: FormaPagamento
  troco_para: string
}

interface PedidoConfirmado {
  id: string
  nome_cliente: string
  itens: ItemCarrinho[]
  subtotal: number
  taxa_entrega: number
  total: number
  forma_pagamento: FormaPagamento
  troco_para: number | null
  observacoes: string | null
  endereco_entrega: string
}

/* ── Helpers ─────────────────────────────────────── */

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function mascaraCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function aplicarMascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function composeEndereco(e: Endereco): string {
  let texto = e.endereco.trim()
  if (e.complemento?.trim()) texto += `, ${e.complemento.trim()}`
  if (e.referencia?.trim()) texto += ` (ref: ${e.referencia.trim()})`
  return texto
}

function rotuloEndereco(e: Endereco): string {
  return e.apelido?.trim() || e.endereco.trim()
}

function incrementoPor(unidade: string): number {
  return unidade === 'kg' ? 0.5 : 1
}

function formatarQtd(qtd: number, unidade: string): string {
  if (unidade === 'kg')
    return qtd.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return String(qtd)
}

const LABEL_UNIDADE: Record<string, string> = {
  un: 'un.', kg: 'kg', g: 'g', maco: 'maço',
  duzia: 'dz.', l: 'L', bandeja: 'bdj.',
}
function labelUnidade(un: string): string {
  return LABEL_UNIDADE[un] ?? un
}

type StatusLoja =
  | { tipo: 'aberto'; fecha: string }
  | { tipo: 'fechado'; abre: string; dia: string | null }
  | null

function calcularStatus(horarios: Loja['horarios']): StatusLoja {
  if (!horarios) return null
  const CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const NOMES  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const now = new Date()
  const diaIdx = now.getDay()
  const agora = now.getHours() * 60 + now.getMinutes()
  const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm }

  const hoje = horarios[CHAVES[diaIdx]]
  if (hoje?.aberto) {
    const abre  = toMin(hoje.abre)
    const fecha = toMin(hoje.fecha)
    if (agora >= abre && agora < fecha) return { tipo: 'aberto', fecha: hoje.fecha }
    if (agora < abre) return { tipo: 'fechado', abre: hoje.abre, dia: null }
  }

  for (let i = 1; i <= 7; i++) {
    const idx = (diaIdx + i) % 7
    const d = horarios[CHAVES[idx]]
    if (d?.aberto) return { tipo: 'fechado', abre: d.abre, dia: NOMES[idx] }
  }
  return null
}

/* ── Geo helpers ─────────────────────────────────── */

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function taxaPorFaixa(faixas: FaixaEntrega[], distanciaKm: number): number | null {
  const ordenadas = [...faixas].sort((a, b) => a.distancia_ate - b.distancia_ate)
  const faixa = ordenadas.find(f => f.distancia_ate >= distanciaKm)
  return faixa ? faixa.taxa : null
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br'
const GEO_HEADERS = { 'Accept-Language': 'pt-BR', 'User-Agent': 'OdeCasa-Delivery' }

async function nominatimQuery(params: Record<string, string>): Promise<{ lat: number; lon: number } | null> {
  try {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${NOMINATIM}&${qs}`, { headers: GEO_HEADERS })
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    return null
  } catch {
    return null
  }
}

async function geocodificarEndereco(endereco: string): Promise<{ lat: number; lon: number } | null> {
  return nominatimQuery({ q: endereco })
}

// Busca por CEP: usa ViaCEP para obter cidade/estado e faz busca estruturada no Nominatim
// (cobertura de postalcode BR no Nominatim é incompleta — busca por cidade é mais confiável)
async function geocodificarCep(cep: string): Promise<{ lat: number; lon: number } | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const vRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    const v = await vRes.json() as Record<string, string>
    if (v.erro) return null
    // busca estruturada: rua + cidade → fallback só cidade+estado
    const coords = v.logradouro
      ? await nominatimQuery({ street: v.logradouro, city: v.localidade, state: v.uf })
      : null
    return coords ?? await nominatimQuery({ city: v.localidade, state: v.uf, country: 'Brasil' })
  } catch {
    return null
  }
}

function labelEntrega(loja: Loja): string {
  const faixas = loja.faixas_entrega
  if (faixas && faixas.length > 0) {
    const ordenadas = [...faixas].sort((a, b) => a.distancia_ate - b.distancia_ate)
    const primeira = ordenadas[0]
    if (primeira.taxa === 0) return `Entrega grátis até ${primeira.distancia_ate} km`
    const menorTaxa = Math.min(...ordenadas.map(f => f.taxa))
    return `Entrega a partir de ${formatarReal(menorTaxa)}`
  }
  return loja.taxa_entrega === 0 ? 'Entrega grátis' : `Entrega ${formatarReal(loja.taxa_entrega)}`
}

/* ── Label pagamento ─────────────────────────────── */

const LABEL_PAGAMENTO: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_entrega: 'Cartão na entrega',
}

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

  if (!filtro) {
    const itens = base.filter(p => !p.categoria_id)
    if (itens.length) secoes.push({ id: 'outros', nome: 'Outros', itens })
  }

  return secoes
}

/* ── Carrinho — reducer ──────────────────────────── */

function carrinhoReducer(state: ItemCarrinho[], acao: AcaoCarrinho): ItemCarrinho[] {
  switch (acao.type) {
    case 'ADICIONAR': {
      if (state.find(i => i.id === acao.produto.id)) {
        const passo = incrementoPor(acao.produto.unidade)
        return state.map(i =>
          i.id === acao.produto.id ? { ...i, quantidade: i.quantidade + passo } : i
        )
      }
      return [...state, {
        id: acao.produto.id,
        nome: acao.produto.nome,
        preco: acao.produto.preco,
        unidade: acao.produto.unidade,
        foto_url: acao.produto.foto_url,
        quantidade: 1,
      }]
    }
    case 'ADICIONAR_ITENS': {
      const novo = [...state]
      for (const { produto, quantidade } of acao.itens) {
        const idx = novo.findIndex(i => i.id === produto.id)
        if (idx >= 0) {
          novo[idx] = { ...novo[idx], quantidade: novo[idx].quantidade + quantidade }
        } else {
          novo.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            unidade: produto.unidade,
            foto_url: produto.foto_url,
            quantidade,
          })
        }
      }
      return novo
    }
    case 'INCREMENTAR': {
      const passo = incrementoPor(acao.unidade)
      return state.map(i =>
        i.id === acao.id ? { ...i, quantidade: i.quantidade + passo } : i
      )
    }
    case 'DECREMENTAR': {
      const passo = incrementoPor(acao.unidade)
      return state.flatMap(i => {
        if (i.id !== acao.id) return [i]
        const nova = +(i.quantidade - passo).toFixed(2)
        return nova > 0 ? [{ ...i, quantidade: nova }] : []
      })
    }
    case 'REMOVER':
      return state.filter(i => i.id !== acao.id)
    case 'LIMPAR':
      return []
  }
}

/* ── Controle de quantidade ──────────────────────── */

interface ControleQtdProps {
  item: ItemCarrinho
  dispatch: React.Dispatch<AcaoCarrinho>
  size?: 'sm' | 'md'
}

function ControleQtd({ item, dispatch, size = 'md' }: ControleQtdProps) {
  const btnCls = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const iconSize = size === 'sm' ? 13 : 15
  const numCls = size === 'sm'
    ? 'text-sm font-semibold w-7 text-center select-none'
    : 'text-base font-semibold w-9 text-center select-none'

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => dispatch({ type: 'DECREMENTAR', id: item.id, unidade: item.unidade })}
        aria-label="Diminuir quantidade"
        className={[
          btnCls,
          'flex items-center justify-center rounded-full',
          'bg-brand-100 text-brand-700 hover:bg-brand-200 active:scale-95',
          'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        ].join(' ')}
      >
        <Minus size={iconSize} strokeWidth={2.5} />
      </button>

      <span className={numCls}>{formatarQtd(item.quantidade, item.unidade)}</span>

      <button
        onClick={() => dispatch({ type: 'INCREMENTAR', id: item.id, unidade: item.unidade })}
        aria-label="Aumentar quantidade"
        className={[
          btnCls,
          'flex items-center justify-center rounded-full',
          'bg-brand-100 text-brand-700 hover:bg-brand-200 active:scale-95',
          'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        ].join(' ')}
      >
        <Plus size={iconSize} strokeWidth={2.5} />
      </button>
    </div>
  )
}

/* ── Card de produto público ─────────────────────── */

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

function isProdutoNovo(criado_em: string | null): boolean {
  if (!criado_em) return false
  return Date.now() - new Date(criado_em).getTime() < SETE_DIAS_MS
}

function FotoPlaceholder({ size = 28 }: { size?: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-line">
      <ImageIcon size={size} strokeWidth={1.25} className="text-ink-mute" />
    </div>
  )
}

interface CardProdutoProps {
  produto: Produto
  itemCarrinho: ItemCarrinho | undefined
  dispatch: React.Dispatch<AcaoCarrinho>
  isMaisVendido?: boolean
}

function CardProduto({ produto, itemCarrinho, dispatch, isMaisVendido }: CardProdutoProps) {
  const isNovo = !isMaisVendido && isProdutoNovo(produto.criado_em)
  const temDesconto = produto.preco_original != null && produto.preco_original > produto.preco
  const desconto = temDesconto ? Math.round((1 - produto.preco / produto.preco_original!) * 100) : 0

  return (
    <Card bodyClassName="p-0" className="hover:shadow-md transition-shadow duration-150 overflow-hidden">
      <div className="aspect-square overflow-hidden relative">
        {produto.foto_url ? (
          <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" />
        ) : (
          <FotoPlaceholder size={28} />
        )}
        {isMaisVendido && (
          <span className="absolute top-2 left-2 bg-ink/70 text-surface text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none">
            Mais vendido
          </span>
        )}
        {isNovo && (
          <span className="absolute top-2 left-2 bg-accent text-brand-900 text-xs font-semibold px-2.5 py-1 rounded-full leading-none shadow-sm">
            Novo
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">{produto.nome}</p>

        {produto.descricao && (
          <p className="text-xs text-ink-mute mt-1 line-clamp-2 leading-relaxed">
            {produto.descricao}
          </p>
        )}

        <div className="mt-2">
          <p className="text-[18px] font-bold text-brand-500 leading-none">
            {formatarReal(produto.preco)}
          </p>
          {temDesconto && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-xs text-ink-mute line-through">{formatarReal(produto.preco_original!)}</span>
              <span className="text-[10px] font-bold bg-accent/20 text-accent rounded-full px-1.5 py-0.5 leading-none">
                -{desconto}%
              </span>
            </div>
          )}
          <p className="text-[11px] text-ink-mute mt-0.5">/ {labelUnidade(produto.unidade)}</p>
        </div>

        <div className="mt-2 flex justify-end">
          {itemCarrinho ? (
            <ControleQtd item={itemCarrinho} dispatch={dispatch} size="sm" />
          ) : (
            <button
              onClick={() => dispatch({ type: 'ADICIONAR', produto })}
              aria-label={`Adicionar ${produto.nome}`}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-brand-500 text-surface hover:bg-brand-600 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Plus size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ── Card e seção de Destaques ───────────────────── */

interface CardDestaqueProps {
  produto: Produto
  itemCarrinho: ItemCarrinho | undefined
  dispatch: React.Dispatch<AcaoCarrinho>
  posicao: number
}

const RANK_BG  = ['bg-accent', 'bg-ink/60', 'bg-ink/45']
const RANK_COR = ['text-brand-900', 'text-surface', 'text-surface']

function CardDestaque({ produto, itemCarrinho, dispatch, posicao }: CardDestaqueProps) {
  const bgCls  = RANK_BG[posicao - 1]  ?? RANK_BG[2]
  const txtCls = RANK_COR[posicao - 1] ?? RANK_COR[2]

  return (
    <div className="shrink-0 w-52 bg-surface rounded-xl shadow-sm overflow-hidden">
      {/* Foto */}
      <div className="relative h-44 w-full overflow-hidden">
        {produto.foto_url ? (
          <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" />
        ) : (
          <FotoPlaceholder size={36} />
        )}
        <span className={`absolute top-2 left-2 ${bgCls} ${txtCls} text-xs font-bold px-2.5 py-1 rounded-full leading-none shadow-sm`}>
          {posicao}° mais pedido
        </span>
      </div>

      {/* Conteúdo */}
      <div className="p-3">
        <p className="text-sm font-semibold text-ink leading-snug line-clamp-2 mb-3">{produto.nome}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-bold text-brand-500 leading-none">{formatarReal(produto.preco)}</p>
          {itemCarrinho ? (
            <ControleQtd item={itemCarrinho} dispatch={dispatch} size="sm" />
          ) : (
            <button
              onClick={() => dispatch({ type: 'ADICIONAR', produto })}
              aria-label={`Adicionar ${produto.nome}`}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-brand-500 text-surface hover:bg-brand-600 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface SecaoDestaquesProps {
  produtos: Produto[]
  topProdutosOrdem: string[]
  carrinho: ItemCarrinho[]
  dispatch: React.Dispatch<AcaoCarrinho>
}

function SecaoDestaques({ produtos, topProdutosOrdem, carrinho, dispatch }: SecaoDestaquesProps) {
  const destaques = topProdutosOrdem
    .map(id => produtos.find(p => p.id === id))
    .filter((p): p is Produto => p != null)

  if (destaques.length === 0) return null

  return (
    <section className="mt-6">
      <SectionTitle className="mb-3">Destaques</SectionTitle>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {destaques.map((p, i) => (
          <CardDestaque
            key={p.id}
            produto={p}
            itemCarrinho={carrinho.find(item => item.id === p.id)}
            dispatch={dispatch}
            posicao={i + 1}
          />
        ))}
      </div>
    </section>
  )
}

/* ── Drawer do carrinho ──────────────────────────── */

interface DrawerCarrinhoProps {
  itens: ItemCarrinho[]
  loja: Loja
  dispatch: React.Dispatch<AcaoCarrinho>
  onFechar: () => void
  onContinuar: () => void
  podeReceber: boolean
}

function DrawerCarrinho({ itens, loja, dispatch, onFechar, onContinuar, podeReceber }: DrawerCarrinhoProps) {
  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const taxa = loja.taxa_entrega
  const total = subtotal + taxa
  const minimo = loja.pedido_minimo ?? 0
  const faltaMinimo = minimo > 0 && subtotal < minimo ? minimo - subtotal : 0
  const statusLoja = calcularStatus(loja.horarios)
  const lojaFechada = statusLoja?.tipo === 'fechado'
  const podeContinuar = faltaMinimo === 0 && !lojaFechada

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onFechar])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho de compras"
    >
      <div className="absolute inset-0 bg-ink/40" onClick={onFechar} aria-hidden="true" />

      <div className="relative bg-surface rounded-t-2xl max-h-[90dvh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line shrink-0">
          <h2 className="text-[18px] font-semibold text-ink">Carrinho</h2>
          <button
            onClick={onFechar}
            aria-label="Fechar carrinho"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={20} strokeWidth={1.75} className="text-ink-soft" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 px-4 py-1">
          {itens.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-3 border-b border-line last:border-0">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-brand-50 shrink-0">
                {item.foto_url ? (
                  <img src={item.foto_url} alt={item.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={18} strokeWidth={1.25} className="text-brand-200" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">{item.nome}</p>
                <p className="text-xs text-ink-soft mt-0.5">
                  {formatarReal(item.preco)}/{labelUnidade(item.unidade)}
                </p>
                <p className="text-sm font-bold text-brand-700 mt-1">
                  {formatarReal(item.preco * item.quantidade)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  onClick={() => dispatch({ type: 'REMOVER', id: item.id })}
                  aria-label={`Remover ${item.nome}`}
                  className="text-ink-mute hover:text-danger transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded p-0.5"
                >
                  <X size={15} strokeWidth={1.75} />
                </button>
                <ControleQtd item={item} dispatch={dispatch} size="sm" />
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 pt-3 pb-6 border-t border-line shrink-0">
          <div className="flex justify-between text-sm text-ink-soft mb-1.5">
            <span>Subtotal</span>
            <span>{formatarReal(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-ink-soft mb-3">
            <span>Taxa de entrega</span>
            <span className={taxa === 0 ? 'text-brand-600 font-medium' : ''}>
              {taxa === 0 ? 'Grátis' : formatarReal(taxa)}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold text-ink mb-4">
            <span>Total</span>
            <span>{formatarReal(total)}</span>
          </div>

          {lojaFechada && (
            <div className="flex items-start gap-2 bg-danger/10 text-danger rounded-lg p-3 mb-4 text-sm leading-snug">
              <AlertCircle size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              <span>
                Loja fechada no momento.
                {statusLoja && statusLoja.tipo === 'fechado' && (
                  <> Abre {statusLoja.dia ? `${statusLoja.dia} às` : 'às'} {statusLoja.abre}.</>
                )}
              </span>
            </div>
          )}

          {faltaMinimo > 0 && (
            <div className="flex items-start gap-2 bg-accent/10 text-accent rounded-lg p-3 mb-4 text-sm leading-snug">
              <AlertCircle size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              <span>Faltam {formatarReal(faltaMinimo)} para o pedido mínimo</span>
            </div>
          )}

          {!podeReceber ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 bg-ink/5 rounded-xl p-4 text-sm leading-snug text-ink-soft">
                <Clock size={18} strokeWidth={1.75} className="shrink-0 mt-0.5 text-ink-mute" />
                <span>
                  Esta loja está com pedidos pausados no momento. Tente novamente em breve ou entre em contato pelo WhatsApp.
                </span>
              </div>
              {loja.whatsapp && (
                <a
                  href={`https://wa.me/55${loja.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-md font-semibold text-sm bg-surface border border-line text-brand-700 hover:bg-brand-50 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <MessageCircle size={18} strokeWidth={1.75} />
                  Falar com a loja
                </a>
              )}
            </div>
          ) : (
            <Button variant="primary" className="w-full" disabled={!podeContinuar} onClick={onContinuar}>
              Continuar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Barra de carrinho (rodapé fixo) ────────────── */

interface BarraCarrinhoProps {
  itens: ItemCarrinho[]
  onAbrir: () => void
}

function BarraCarrinho({ itens, onAbrir }: BarraCarrinhoProps) {
  if (itens.length === 0) return null

  const totalItens = itens.length
  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0)

  return (
    <div className="animate-slide-up fixed bottom-0 inset-x-0 z-40 px-4 pb-4 pt-3 pointer-events-none">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onAbrir}
          aria-label={`Ver carrinho, ${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`}
          className={[
            'pointer-events-auto w-full flex items-center justify-between',
            'bg-brand-500 text-surface rounded-xl px-4 h-14',
            'hover:bg-brand-600 active:scale-[0.99] transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
            'shadow-lg',
          ].join(' ')}
        >
          <div className="flex items-center gap-2.5">
            <span className="bg-brand-600 text-surface text-xs font-bold rounded-md px-1.5 py-0.5 leading-none">
              {totalItens}
            </span>
            <span className="text-sm font-semibold">
              Ver carrinho · {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <span className="text-sm font-bold">{formatarReal(subtotal)}</span>
        </button>
      </div>
    </div>
  )
}

/* ── Drawer de informações da loja ──────────────── */

interface DrawerInfoProps {
  loja: Loja
  onFechar: () => void
}

function DrawerInfo({ loja, onFechar }: DrawerInfoProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onFechar])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Informações da loja"
    >
      <div className="absolute inset-0 bg-ink/40" onClick={onFechar} aria-hidden="true" />

      <div className="relative bg-surface rounded-t-2xl max-h-[70dvh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line shrink-0">
          <h2 className="text-[18px] font-semibold text-ink">Informações</h2>
          <button
            onClick={onFechar}
            aria-label="Fechar informações"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={20} strokeWidth={1.75} className="text-ink-soft" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 px-4 py-5 space-y-5">
          {loja.endereco && (
            <div className="flex items-start gap-3">
              <MapPin size={18} strokeWidth={1.75} className="text-brand-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">Endereço</p>
                <p className="text-sm text-ink-soft mt-0.5 leading-relaxed">{loja.endereco}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Truck size={18} strokeWidth={1.75} className="text-brand-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink">Taxa de entrega</p>
              <p className={[
                'text-sm mt-0.5',
                loja.taxa_entrega === 0 ? 'text-brand-600 font-medium' : 'text-ink-soft',
              ].join(' ')}>
                {loja.taxa_entrega === 0 ? 'Grátis' : formatarReal(loja.taxa_entrega)}
              </p>
            </div>
          </div>

          {loja.pedido_minimo != null && loja.pedido_minimo > 0 && (
            <div className="flex items-start gap-3">
              <ShoppingBag size={18} strokeWidth={1.75} className="text-brand-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">Pedido mínimo</p>
                <p className="text-sm text-ink-soft mt-0.5">{formatarReal(loja.pedido_minimo)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-6 pt-3 border-t border-line shrink-0">
          <button
            onClick={onFechar}
            className="w-full min-h-[48px] rounded-md bg-brand-50 text-brand-700 font-semibold text-sm hover:bg-brand-100 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Tela de checkout ────────────────────────────── */

const OPCOES_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_entrega', label: 'Cartão na entrega' },
  { value: 'dinheiro', label: 'Dinheiro' },
]

interface TelaCheckoutProps {
  carrinho: ItemCarrinho[]
  loja: Loja
  cliente: Cliente | null
  enderecos: Endereco[]
  onVoltar: () => void
  onPedidoFeito: (pedido: PedidoConfirmado) => void
  onEnderecoSalvo: () => void
}

type GeoStatus =
  | { tipo: 'idle' }
  | { tipo: 'calculando' }
  | { tipo: 'ok'; distanciaKm: number; taxa: number }
  | { tipo: 'fora_raio'; distanciaKm: number }
  | { tipo: 'degradado' }

function TelaCheckout({
  carrinho, loja, cliente, enderecos, onVoltar, onPedidoFeito, onEnderecoSalvo,
}: TelaCheckoutProps) {
  const lojaTemGeo =
    loja.latitude != null &&
    loja.longitude != null &&
    loja.faixas_entrega != null &&
    loja.faixas_entrega.length > 0

  const subtotal = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const minimo = loja.pedido_minimo ?? 0
  const faltaMinimo = minimo > 0 && subtotal < minimo ? minimo - subtotal : 0

  const temEnderecosSalvos = cliente !== null && enderecos.length > 0
  const enderecoPadrao = enderecos.find(e => e.padrao) ?? enderecos[0]

  const [form, setForm] = useState<FormCheckout>({
    nome: cliente?.nome ?? '',
    telefone: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    referencia: '',
    observacoes: '',
    forma_pagamento: 'pix',
    troco_para: '',
  })
  const [enderecoSelId, setEnderecoSelId] = useState<string | null>(
    temEnderecosSalvos ? enderecoPadrao.id : null
  )
  const [salvarEndereco, setSalvarEndereco] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>({ tipo: 'idle' })
  const [erros, setErros] = useState<Partial<Record<keyof FormCheckout | 'geral', string>>>({})
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Geocodifica endereço salvo quando o cliente seleciona um
  useEffect(() => {
    if (!lojaTemGeo) return
    if (enderecoSelId === null) {
      setGeoStatus({ tipo: 'idle' })
      return
    }
    const end = enderecos.find(e => e.id === enderecoSelId)
    if (!end) return
    setGeoStatus({ tipo: 'calculando' })
    ;(async () => {
      // tenta CEP primeiro (mais preciso), depois endereço completo
      const coords = end.cep
        ? (await geocodificarCep(end.cep) ?? await geocodificarEndereco(`${end.endereco}, Brasil`))
        : await geocodificarEndereco(`${end.endereco}, Brasil`)
      if (!coords) { setGeoStatus({ tipo: 'degradado' }); return }
      const distanciaKm = haversine(loja.latitude!, loja.longitude!, coords.lat, coords.lon)
      const raio = loja.raio_maximo_km ?? 999
      if (distanciaKm > raio) { setGeoStatus({ tipo: 'fora_raio', distanciaKm }); return }
      const taxa = taxaPorFaixa(loja.faixas_entrega!, distanciaKm) ?? loja.taxa_entrega
      setGeoStatus({ tipo: 'ok', distanciaKm, taxa })
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enderecoSelId, lojaTemGeo])

  // Taxa dinâmica: usa faixa calculada quando disponível
  const usandoSalvo = cliente !== null && enderecoSelId !== null
  const taxaEntrega = geoStatus.tipo === 'ok' ? geoStatus.taxa : loja.taxa_entrega
  const total = subtotal + taxaEntrega

  function set(campo: keyof FormCheckout, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    setErros(e => ({ ...e, [campo]: undefined }))
  }

  async function calcularDistancia(rua: string, bairro: string, cidade: string) {
    if (!lojaTemGeo) return
    setGeoStatus({ tipo: 'calculando' })
    const cepDigits = form.cep.replace(/\D/g, '')
    const coords = cepDigits.length === 8
      ? (await geocodificarCep(cepDigits) ?? await geocodificarEndereco([rua, bairro, cidade, 'Brasil'].filter(Boolean).join(', ')))
      : await geocodificarEndereco([rua, bairro, cidade, 'Brasil'].filter(Boolean).join(', '))
    if (!coords) {
      setGeoStatus({ tipo: 'degradado' })
      return
    }
    const distanciaKm = haversine(loja.latitude!, loja.longitude!, coords.lat, coords.lon)
    const raio = loja.raio_maximo_km ?? 999
    if (distanciaKm > raio) {
      setGeoStatus({ tipo: 'fora_raio', distanciaKm })
      return
    }
    const taxa = taxaPorFaixa(loja.faixas_entrega!, distanciaKm) ?? loja.taxa_entrega
    setGeoStatus({ tipo: 'ok', distanciaKm, taxa })
  }

  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, '')
    if (limpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      if (!res.ok) return
      const data = await res.json() as Record<string, string>
      if (data.erro) return
      const novaRua    = data.logradouro || form.rua
      const novoBairro = data.bairro     || form.bairro
      const novaCidade = data.localidade || form.cidade
      setForm(f => ({ ...f, rua: novaRua, bairro: novoBairro, cidade: novaCidade }))
      setErros(e => ({ ...e, rua: undefined, bairro: undefined }))
      if (lojaTemGeo && novaCidade) {
        calcularDistancia(novaRua, novoBairro, novaCidade)
      }
    } catch {
      // falha silenciosa — usuário preenche manualmente
    } finally {
      setBuscandoCep(false)
    }
  }

  function handleCepChange(valor: string) {
    const mascarado = mascaraCep(valor)
    set('cep', mascarado)
    if (lojaTemGeo) setGeoStatus({ tipo: 'idle' })
    if (mascarado.replace(/\D/g, '').length === 8) buscarCep(mascarado)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Verifica se a loja ainda está aberta no momento do envio
    const statusAtual = calcularStatus(loja.horarios)
    if (statusAtual?.tipo === 'fechado') {
      setErros(prev => ({ ...prev, geral: 'A loja está fechada no momento. Tente novamente quando estiver aberta.' }))
      return
    }

    const enderecoSalvo = usandoSalvo
      ? enderecos.find(e => e.id === enderecoSelId)
      : undefined

    // Monta string de entrega a partir dos campos estruturados
    const partesPrincipal = [
      form.rua.trim(),
      form.numero.trim(),
      form.complemento.trim(),
    ].filter(Boolean).join(', ')
    const enderecoNovo = partesPrincipal
      ? `${partesPrincipal} — ${form.bairro.trim()}, ${form.cidade.trim()} — CEP ${form.cep.trim()}${form.referencia.trim() ? ` | Ref: ${form.referencia.trim()}` : ''}`
      : ''

    const enderecoEntrega = enderecoSalvo
      ? composeEndereco(enderecoSalvo)
      : enderecoNovo

    const novosErros: typeof erros = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe seu nome completo.'
    if (!form.telefone.trim()) novosErros.telefone = 'Informe seu número de WhatsApp.'
    else if (form.telefone.replace(/\D/g, '').length < 10) novosErros.telefone = 'Número de telefone incompleto. Inclua o DDD.'
    if (!usandoSalvo) {
      if (!form.cep.replace(/\D/g, '').length) novosErros.cep = 'Informe o CEP do endereço de entrega.'
      else if (form.cep.replace(/\D/g, '').length !== 8) novosErros.cep = 'CEP inválido — deve ter 8 dígitos.'
      if (!form.rua.trim()) novosErros.rua = 'Informe o nome da rua ou avenida.'
      if (!form.numero.trim()) novosErros.numero = 'Informe o número do imóvel.'
      else if (!/^\d+[A-Za-z]?$/.test(form.numero.trim())) novosErros.numero = 'Número do imóvel inválido.'
      if (!form.bairro.trim()) novosErros.bairro = 'Informe o bairro.'
    }

    if (form.forma_pagamento === 'dinheiro' && form.troco_para.trim()) {
      const troco = parseFloat(form.troco_para.replace(',', '.'))
      if (isNaN(troco) || troco < total) {
        novosErros.troco_para = `O valor do troco deve ser maior ou igual ao total do pedido (${formatarReal(total)}).`
      }
    }

    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setEnviando(true)

    try {
      const pedidoId = crypto.randomUUID()
      const trocoPara =
        form.forma_pagamento === 'dinheiro' && form.troco_para.trim()
          ? parseFloat(form.troco_para.replace(',', '.'))
          : null

      const { error: errPedido } = await supabase.from('pedidos').insert({
        id: pedidoId,
        loja_id: loja.id,
        cliente_id: cliente?.id ?? null,
        nome_cliente: form.nome.trim(),
        telefone_cliente: form.telefone.trim(),
        endereco_entrega: enderecoEntrega,
        observacoes: form.observacoes.trim() || null,
        forma_pagamento: form.forma_pagamento,
        troco_para: trocoPara,
        subtotal: +subtotal.toFixed(2),
        taxa_entrega: taxaEntrega,
        total: +total.toFixed(2),
        status: 'recebido',
      })

      if (errPedido) throw errPedido

      const { error: errItens } = await supabase.from('itens_pedido').insert(
        carrinho.map(item => ({
          pedido_id: pedidoId,
          produto_id: item.id,
          nome_produto: item.nome,
          preco_unitario: item.preco,
          unidade: item.unidade,
          quantidade: item.quantidade,
          subtotal: +(item.preco * item.quantidade).toFixed(2),
        }))
      )

      if (errItens) throw errItens

      fetch('/api/webhook/disparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loja_id: loja.id, evento: 'pedido.criado', pedido_id: pedidoId }),
      }).catch(() => {})

      if (cliente?.email) {
        fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo:           'confirmacao',
            email:          cliente.email,
            nome_cliente:   form.nome.trim(),
            nome_loja:      loja.nome,
            pedido_id_curto: pedidoId.slice(0, 8).toUpperCase(),
            itens:          carrinho.map(i => ({ nome: i.nome, quantidade: i.quantidade, subtotal: +(i.preco * i.quantidade).toFixed(2) })),
            taxa_entrega:   taxaEntrega,
            total:          +total.toFixed(2),
            whatsapp:       loja.whatsapp ?? undefined,
          }),
        }).catch(() => {})
      }

      // Cliente logado optou por salvar o endereço novo digitado
      if (cliente && !usandoSalvo && salvarEndereco && form.rua.trim()) {
        const enderecoBase = `${form.rua.trim()}, ${form.numero.trim()} — ${form.bairro.trim()}, ${form.cidade.trim()} — CEP ${form.cep.trim()}`
        await supabase.from('enderecos').insert({
          cliente_id: cliente.id,
          endereco: enderecoBase,
          complemento: form.complemento.trim() || null,
          referencia: form.referencia.trim() || null,
          padrao: enderecos.length === 0,
        })
        onEnderecoSalvo()
      }

      onPedidoFeito({
        id: pedidoId,
        nome_cliente: form.nome.trim(),
        itens: carrinho,
        subtotal: +subtotal.toFixed(2),
        taxa_entrega: taxaEntrega,
        total: +total.toFixed(2),
        forma_pagamento: form.forma_pagamento,
        troco_para: trocoPara,
        observacoes: form.observacoes.trim() || null,
        endereco_entrega: enderecoEntrega,
      })
    } catch (err) {
      console.error('[OdeCasa] Erro ao finalizar pedido:', err)
      setErros(e => ({ ...e, geral: 'Não foi possível enviar seu pedido. Verifique sua conexão e tente novamente.' }))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* Cabeçalho */}
      <header className="bg-surface border-b border-line shrink-0">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={onVoltar}
            aria-label="Voltar ao carrinho"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={1.75} className="text-ink" />
          </button>
          <h1 className="text-base font-semibold text-ink">Finalizar pedido</h1>
        </div>
      </header>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <form id="form-checkout" onSubmit={handleSubmit} noValidate>
          <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

            {/* Incentivo para convidado entrar/criar conta — sem bloquear o pedido */}
            {!cliente && (
              <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <User size={18} strokeWidth={1.75} className="text-brand-600 shrink-0" />
                <p className="text-sm text-ink-soft flex-1 leading-snug">
                  Tem conta? Entre para salvar seus endereços e pedir mais rápido.
                </p>
                <Link
                  href={`/entrar?redirect=${encodeURIComponent(`/loja/${loja.slug}`)}`}
                  className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
                >
                  Entrar
                </Link>
              </div>
            )}

            {/* Resumo dos itens */}
            <div className="bg-surface rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-[15px] font-semibold text-ink">Resumo do pedido</h2>
              </div>

              {carrinho.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-line">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 text-xs font-bold text-brand-700 bg-brand-100 rounded px-1.5 py-0.5 leading-none">
                      {formatarQtd(item.quantidade, item.unidade)}
                      {' '}{labelUnidade(item.unidade)}
                    </span>
                    <span className="text-sm text-ink truncate">{item.nome}</span>
                  </div>
                  <span className="text-sm font-semibold text-ink shrink-0">
                    {formatarReal(item.preco * item.quantidade)}
                  </span>
                </div>
              ))}

              <div className="px-4 pt-3 pb-4 border-t border-line space-y-1.5 mt-1">
                <div className="flex justify-between text-sm text-ink-soft">
                  <span>Subtotal</span>
                  <span>{formatarReal(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-ink-soft">
                  <span>Taxa de entrega</span>
                  <span className={taxaEntrega === 0 ? 'text-brand-600 font-medium' : ''}>
                    {geoStatus.tipo === 'ok'
                      ? `${taxaEntrega === 0 ? 'Grátis' : formatarReal(taxaEntrega)} (${geoStatus.distanciaKm.toFixed(1)} km)`
                      : taxaEntrega === 0 ? 'Grátis' : formatarReal(taxaEntrega)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-ink pt-1 border-t border-line">
                  <span>Total</span>
                  <span>{formatarReal(total)}</span>
                </div>
              </div>

              {faltaMinimo > 0 && (
                <div className="flex items-start gap-2 mx-4 mb-4 bg-accent/10 text-accent rounded-lg p-3 text-sm leading-snug">
                  <AlertCircle size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                  <span>Faltam {formatarReal(faltaMinimo)} para o pedido mínimo</span>
                </div>
              )}
            </div>

            {/* Dados pessoais */}
            <div className="bg-surface rounded-xl px-4 py-4 shadow-sm space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Seus dados</h2>

              <div>
                <Input
                  id="nome"
                  label="Nome completo"
                  placeholder="Como quer ser chamado"
                  value={form.nome}
                  onChange={e => set('nome', e.target.value)}
                  autoComplete="name"
                />
                {erros.nome && <p className="text-xs text-danger mt-1">{erros.nome}</p>}
              </div>

              <div>
                <Input
                  id="telefone"
                  label="WhatsApp / Telefone"
                  placeholder="(11) 9 0000-0000"
                  type="tel"
                  inputMode="tel"
                  value={form.telefone}
                  onChange={e => set('telefone', aplicarMascaraTelefone(e.target.value))}
                  autoComplete="tel"
                />
                {erros.telefone && <p className="text-xs text-danger mt-1">{erros.telefone}</p>}
              </div>
            </div>

            {/* Entrega */}
            <div className="bg-surface rounded-xl px-4 py-4 shadow-sm space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Entrega</h2>

              {/* Cliente logado com endereços salvos: escolher um ou digitar novo */}
              {temEnderecosSalvos && (
                <div className="space-y-2">
                  {enderecos.map(end => (
                    <button
                      key={end.id}
                      type="button"
                      onClick={() => setEnderecoSelId(end.id)}
                      className={[
                        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        enderecoSelId === end.id
                          ? 'bg-brand-50 border-brand-500'
                          : 'bg-surface border-line hover:bg-brand-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">{rotuloEndereco(end)}</span>
                        {end.padrao && (
                          <span className="text-[10px] font-medium text-brand-700 bg-brand-100 rounded-full px-1.5 py-0.5">
                            Padrão
                          </span>
                        )}
                      </div>
                      {end.apelido && (
                        <p className="text-xs text-ink-soft mt-0.5 leading-snug">{end.endereco}</p>
                      )}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setEnderecoSelId(null)}
                    className={[
                      'w-full text-left rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      enderecoSelId === null
                        ? 'bg-brand-50 border-brand-500 text-brand-700'
                        : 'bg-surface border-line text-ink-soft hover:bg-brand-50',
                    ].join(' ')}
                  >
                    + Usar um novo endereço
                  </button>

                  {/* Status de geo para endereço salvo */}
                  {lojaTemGeo && enderecoSelId !== null && geoStatus.tipo !== 'idle' && (
                    <div className="mt-1">
                      {geoStatus.tipo === 'calculando' && (
                        <p className="text-xs text-ink-mute animate-pulse">Calculando distância…</p>
                      )}
                      {geoStatus.tipo === 'fora_raio' && (
                        <div className="flex items-start gap-2 bg-danger/10 text-danger rounded-lg p-3 text-sm leading-snug">
                          <AlertCircle size={15} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                          <span>
                            Endereço fora da área de entrega. A loja entrega até{' '}
                            <strong>{loja.raio_maximo_km} km</strong>{' '}
                            (você está a {geoStatus.distanciaKm.toFixed(1)} km).
                          </span>
                        </div>
                      )}
                      {geoStatus.tipo === 'ok' && (
                        <p className="text-xs text-brand-600 font-medium">
                          Distância estimada: {geoStatus.distanciaKm.toFixed(1)} km ·{' '}
                          {geoStatus.taxa === 0 ? 'Entrega grátis' : `Taxa ${formatarReal(geoStatus.taxa)}`}
                        </p>
                      )}
                      {geoStatus.tipo === 'degradado' && (
                        <p className="text-xs text-ink-mute">
                          Não foi possível calcular a distância — taxa padrão aplicada.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Campos estruturados de endereço: convidado, logado sem endereços, ou logado escolhendo "novo" */}
              {(!temEnderecosSalvos || enderecoSelId === null) && (
                <div className="space-y-3">
                  {/* CEP */}
                  <div>
                    <div className="relative">
                      <Input
                        id="cep"
                        label="CEP"
                        placeholder="00000-000"
                        value={form.cep}
                        onChange={e => handleCepChange(e.target.value)}
                        autoComplete="postal-code"
                        inputMode="numeric"
                      />
                      {buscandoCep && (
                        <span className="absolute right-3 top-[38px] text-xs text-ink-mute animate-pulse">
                          Buscando…
                        </span>
                      )}
                    </div>
                    {erros.cep && <p className="text-xs text-danger mt-1">{erros.cep}</p>}

                    {/* Status de entrega por distância */}
                    {lojaTemGeo && geoStatus.tipo !== 'idle' && (
                      <div className="mt-2">
                        {geoStatus.tipo === 'calculando' && (
                          <p className="text-xs text-ink-mute animate-pulse">Calculando distância…</p>
                        )}
                        {geoStatus.tipo === 'fora_raio' && (
                          <div className="flex items-start gap-2 bg-danger/10 text-danger rounded-lg p-3 text-sm leading-snug">
                            <AlertCircle size={15} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                            <span>
                              Endereço fora da área de entrega. A loja entrega até{' '}
                              <strong>{loja.raio_maximo_km} km</strong>{' '}
                              (você está a {geoStatus.distanciaKm.toFixed(1)} km).
                            </span>
                          </div>
                        )}
                        {geoStatus.tipo === 'ok' && (
                          <p className="text-xs text-brand-600 font-medium">
                            Distância estimada: {geoStatus.distanciaKm.toFixed(1)} km ·{' '}
                            {geoStatus.taxa === 0 ? 'Entrega grátis' : `Taxa ${formatarReal(geoStatus.taxa)}`}
                          </p>
                        )}
                        {geoStatus.tipo === 'degradado' && (
                          <p className="text-xs text-ink-mute">
                            Não foi possível calcular a distância exata — taxa padrão aplicada.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rua + Número */}
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div>
                      <Input
                        id="rua"
                        label="Rua / Avenida"
                        placeholder="Nome da rua"
                        value={form.rua}
                        onChange={e => set('rua', e.target.value)}
                        autoComplete="address-line1"
                      />
                      {erros.rua && <p className="text-xs text-danger mt-1">{erros.rua}</p>}
                    </div>
                    <div className="w-24">
                      <Input
                        id="numero"
                        label="Número"
                        placeholder="123"
                        value={form.numero}
                        onChange={e => set('numero', e.target.value)}
                        autoComplete="address-line2"
                        inputMode="numeric"
                      />
                      {erros.numero && <p className="text-xs text-danger mt-1">{erros.numero}</p>}
                    </div>
                  </div>

                  {/* Complemento */}
                  <div>
                    <Input
                      id="complemento"
                      label={<>Complemento <span className="text-ink-mute font-normal">(opcional)</span></>}
                      placeholder="Apto, bloco, casa…"
                      value={form.complemento}
                      onChange={e => set('complemento', e.target.value)}
                      autoComplete="address-line3"
                    />
                  </div>

                  {/* Bairro */}
                  <div>
                    <Input
                      id="bairro"
                      label="Bairro"
                      placeholder="Nome do bairro"
                      value={form.bairro}
                      onChange={e => set('bairro', e.target.value)}
                    />
                    {erros.bairro && <p className="text-xs text-danger mt-1">{erros.bairro}</p>}
                  </div>

                  {/* Cidade (read-only, preenchida pelo ViaCEP) */}
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">
                      Cidade
                    </label>
                    <div className="h-12 px-4 flex items-center rounded-md border border-line bg-[--color-bg] text-sm text-ink-soft">
                      {form.cidade || <span className="text-ink-mute">Preenchida automaticamente pelo CEP</span>}
                    </div>
                  </div>

                  {/* Ponto de referência */}
                  <div>
                    <Input
                      id="referencia"
                      label={<>Ponto de referência <span className="text-ink-mute font-normal">(opcional)</span></>}
                      placeholder="Próximo ao mercado, portão azul…"
                      value={form.referencia}
                      onChange={e => set('referencia', e.target.value)}
                    />
                  </div>

                  {/* Salvar endereço só faz sentido para cliente logado */}
                  {cliente && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={salvarEndereco}
                        onChange={e => setSalvarEndereco(e.target.checked)}
                        className="w-4 h-4 rounded border-line text-brand-500 focus:ring-brand-500 focus:ring-2"
                      />
                      <span className="text-sm text-ink-soft">Salvar este endereço na minha conta</span>
                    </label>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="observacoes" className="text-sm font-medium text-ink leading-none">
                  Observações{' '}
                  <span className="text-ink-mute font-normal">(opcional)</span>
                </label>
                <textarea
                  id="observacoes"
                  rows={3}
                  placeholder="Ponto de referência, instruções especiais..."
                  value={form.observacoes}
                  onChange={e => set('observacoes', e.target.value)}
                  className={[
                    'w-full rounded-md border border-line bg-surface px-4 py-3',
                    'text-sm text-ink placeholder:text-ink-mute resize-none',
                    'outline-none transition-shadow duration-150',
                    'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                  ].join(' ')}
                />
              </div>
            </div>

            {/* Pagamento */}
            <div className="bg-surface rounded-xl px-4 py-4 shadow-sm space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Pagamento</h2>

              <div className="grid grid-cols-3 gap-2">
                {OPCOES_PAGAMENTO.map(op => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => {
                      set('forma_pagamento', op.value)
                      if (op.value !== 'dinheiro') set('troco_para', '')
                    }}
                    className={[
                      'py-3 px-2 rounded-lg border text-sm font-medium text-center leading-snug',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      form.forma_pagamento === op.value
                        ? 'bg-brand-100 border-brand-500 text-brand-700'
                        : 'bg-surface border-line text-ink-soft hover:bg-brand-50',
                    ].join(' ')}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              {/* Bloco Pix — exibido apenas se a loja tiver chave cadastrada */}
              {form.forma_pagamento === 'pix' && loja.chave_pix && (
                <div className="rounded-xl bg-brand-50 border border-brand-200 p-4 space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                      Chave Pix
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-mono font-semibold text-ink flex-1 break-all">
                        {loja.chave_pix}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(loja.chave_pix!)
                          setCopiado(true)
                          setTimeout(() => setCopiado(false), 2000)
                        }}
                        aria-label="Copiar chave Pix"
                        className={[
                          'shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150',
                          copiado
                            ? 'bg-brand-500 text-white'
                            : 'bg-surface border border-brand-300 text-brand-700 hover:bg-brand-100',
                        ].join(' ')}
                      >
                        {copiado
                          ? <><Check size={13} strokeWidth={2.5} />Copiado!</>
                          : <><Copy size={13} strokeWidth={1.75} />Copiar chave</>}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-brand-200 pt-3 flex justify-between items-center">
                    <span className="text-sm text-ink-soft">Total a pagar</span>
                    <span className="text-base font-bold text-brand-700">{formatarReal(total)}</span>
                  </div>

                  <p className="text-xs text-ink-soft leading-relaxed">
                    Você pode pagar agora ou na entrega — mostre o comprovante ao entregador.
                  </p>
                </div>
              )}

              {form.forma_pagamento === 'dinheiro' && (
                <div>
                  <Input
                    id="troco_para"
                    label="Troco para (opcional)"
                    placeholder="Ex: 50,00"
                    type="text"
                    inputMode="decimal"
                    value={form.troco_para}
                    onChange={e => set('troco_para', e.target.value)}
                  />
                  {erros.troco_para && <p className="text-xs text-danger mt-1">{erros.troco_para}</p>}
                </div>
              )}
            </div>

            {/* Erro geral */}
            {erros.geral && (
              <div className="flex items-start gap-2 bg-danger/10 text-danger rounded-lg p-3 text-sm leading-snug">
                <AlertCircle size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                <span>{erros.geral}</span>
              </div>
            )}

            {/* Botão de envio — guard final: re-verifica se loja ainda pode receber */}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={enviando || faltaMinimo > 0 || geoStatus.tipo === 'fora_raio'}
            >
              {enviando ? 'Enviando pedido…' : 'Fazer pedido'}
            </Button>

            {/* Espaço seguro para teclado */}
            <div className="h-4" />
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Tela de confirmação ─────────────────────────── */

interface TelaConfirmacaoProps {
  pedido: PedidoConfirmado
  loja: Loja
  cliente: Cliente | null
  onVoltarLoja: () => void
}

const ETAPAS_CONFIRMACAO = [
  { key: 'recebido',     label: 'Recebido' },
  { key: 'preparando',   label: 'Preparando' },
  { key: 'saiu_entrega', label: 'A caminho' },
  { key: 'entregue',     label: 'Entregue' },
]

function TelaConfirmacao({ pedido, loja, cliente, onVoltarLoja }: TelaConfirmacaoProps) {
  const router = useRouter()
  const idCurto = pedido.id.slice(0, 8).toUpperCase()
  const [copiado, setCopiado] = useState(false)
  const [mostrarConvite, setMostrarConvite] = useState(!cliente)

  const avisouRef = useRef(false)
  useEffect(() => {
    if (!cliente || avisouRef.current) return
    avisouRef.current = true
    toast('Acompanhe seu pedido em Minha conta', {
      description: 'O status atualiza em tempo real por lá.',
      icon: <Bell size={18} strokeWidth={1.75} />,
      duration: 6000,
      action: { label: 'Ver', onClick: () => router.push('/conta') },
    })
  }, [cliente, router])

  function handleCopiarId() {
    navigator.clipboard.writeText(idCurto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5 animate-page-enter">

        {/* Hero */}
        <div className="flex flex-col items-center text-center pt-6 pb-2">
          <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center mb-5 shadow-md">
            <CheckCircle2 size={44} strokeWidth={1.75} className="text-surface" />
          </div>
          <h1 className="text-3xl font-bold text-ink">Pedido confirmado!</h1>
          <p className="text-base text-ink-soft mt-2">
            A {loja.nome} recebeu seu pedido.
          </p>
          <div className="flex items-center gap-2 mt-3 bg-brand-50 rounded-full px-4 py-1.5">
            <span className="text-sm font-semibold text-brand-700">#{idCurto}</span>
            <button
              onClick={handleCopiarId}
              aria-label="Copiar número do pedido"
              title="Copiar número do pedido"
              className="text-brand-500 hover:text-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded p-0.5"
            >
              {copiado
                ? <Check size={14} strokeWidth={2.5} />
                : <Copy size={14} strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {/* Timeline de status */}
        <div className="bg-surface rounded-xl px-4 py-5 shadow-sm">
          <p className="text-sm font-semibold text-ink mb-5">Acompanhamento</p>
          <div className="flex">
            {ETAPAS_CONFIRMACAO.map((etapa, i) => {
              const ativo = i === 0
              return (
                <div key={etapa.key} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && (
                    <span aria-hidden="true" className="absolute top-[11px] left-[-50%] right-1/2 h-0.5 bg-line" />
                  )}
                  <span className={[
                    'relative z-10 w-6 h-6 rounded-full flex items-center justify-center',
                    ativo
                      ? 'bg-brand-500 text-surface animate-pulse-ring'
                      : 'bg-surface border border-line',
                  ].join(' ')}>
                    {ativo
                      ? <span className="w-2 h-2 rounded-full bg-surface" />
                      : <span className="w-1.5 h-1.5 rounded-full bg-line" />}
                  </span>
                  <span className={[
                    'mt-2 text-[11px] leading-tight text-center px-0.5',
                    ativo ? 'font-semibold text-ink' : 'text-ink-mute',
                  ].join(' ')}>
                    {etapa.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Entrega */}
        {pedido.endereco_entrega && (
          <div className="bg-surface rounded-xl px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-ink mb-3">Entrega</p>
            <div className="flex items-start gap-3">
              <MapPin size={16} strokeWidth={1.75} className="text-brand-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-soft leading-relaxed">{pedido.endereco_entrega}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.endereco_entrega)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-700 hover:text-brand-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                >
                  <ExternalLink size={12} strokeWidth={1.75} />
                  Ver no mapa
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Resumo do pedido */}
        <div className="bg-surface rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <p className="text-sm font-semibold text-ink">Resumo do pedido</p>
          </div>

          {pedido.itens.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-line">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-xs font-bold text-brand-700 bg-brand-100 rounded px-1.5 py-0.5 leading-none">
                  {formatarQtd(item.quantidade, item.unidade)} {labelUnidade(item.unidade)}
                </span>
                <span className="text-sm text-ink truncate">{item.nome}</span>
              </div>
              <span className="text-sm font-semibold text-ink shrink-0">
                {formatarReal(item.preco * item.quantidade)}
              </span>
            </div>
          ))}

          <div className="px-4 pt-3 pb-4 border-t border-line space-y-1.5 mt-1">
            <div className="flex justify-between text-sm text-ink-soft">
              <span>Subtotal</span>
              <span>{formatarReal(pedido.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-soft">
              <span>Taxa de entrega</span>
              <span className={pedido.taxa_entrega === 0 ? 'text-brand-600 font-medium' : ''}>
                {pedido.taxa_entrega === 0 ? 'Grátis' : formatarReal(pedido.taxa_entrega)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-ink pt-2 border-t border-line">
              <span>Total</span>
              <span>{formatarReal(pedido.total)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1">
              <span className="text-ink-soft">Pagamento</span>
              <span className="text-ink font-medium">{LABEL_PAGAMENTO[pedido.forma_pagamento]}</span>
            </div>
            {pedido.troco_para != null && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Troco para</span>
                <span className="text-ink font-medium">{formatarReal(pedido.troco_para)}</span>
              </div>
            )}
            {pedido.observacoes && (
              <div className="text-sm text-ink-soft mt-2 pt-2 border-t border-line leading-relaxed">
                <span className="font-medium text-ink">Obs:</span> {pedido.observacoes}
              </div>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 pb-8">
          <Button variant="primary" className="w-full" onClick={() => router.push('/conta')}>
            Acompanhar meu pedido
          </Button>

          {loja.whatsapp && (
            <a
              href={`https://wa.me/${loja.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-md font-semibold text-sm bg-surface border border-line text-brand-700 hover:bg-brand-50 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <MessageCircle size={18} strokeWidth={1.75} />
              Falar com a loja
            </a>
          )}

          <button
            onClick={onVoltarLoja}
            className="inline-flex items-center justify-center min-h-[44px] px-5 text-sm font-semibold text-brand-700 hover:text-brand-900 hover:bg-brand-50 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Voltar à loja
          </button>
        </div>
      </div>

      {/* Convidado: convite para criar conta */}
      {mostrarConvite && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="convite-titulo"
          onClick={() => setMostrarConvite(false)}
        >
          <div
            className="animate-modal-in w-full max-w-sm bg-surface rounded-xl shadow-lg p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setMostrarConvite(false)}
              aria-label="Fechar"
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X size={18} strokeWidth={1.75} />
            </button>

            <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
              <Bell size={22} strokeWidth={1.75} className="text-brand-600" />
            </div>

            <h2 id="convite-titulo" className="text-[18px] font-semibold text-ink">
              Acompanhe seu pedido
            </h2>
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">
              Crie sua conta para ver o status do pedido em tempo real, direto em Minha conta.
            </p>

            <div className="flex flex-col gap-2 mt-5">
              <Link
                href={`/criar-conta?redirect=${encodeURIComponent('/conta')}`}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-md font-semibold text-sm bg-brand-500 text-surface hover:bg-brand-600 active:scale-[0.98] shadow-sm transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Criar conta
              </Link>
              <button
                onClick={() => setMostrarConvite(false)}
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-md font-semibold text-sm text-brand-700 hover:bg-brand-50 active:scale-[0.98] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function PaginaLoja() {
  const { slug } = useParams() as { slug: string }

  const [loja, setLoja]             = useState<Loja | null | undefined>(undefined)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [produtos, setProdutos]     = useState<Produto[]>([])
  const [topProdutosIds, setTopProdutosIds] = useState<Set<string>>(new Set())
  const [topProdutosOrdem, setTopProdutosOrdem] = useState<string[]>([])
  const [mediaAvaliacoes, setMediaAvaliacoes] = useState<{ media: number; total: number } | null>(null)
  const [filtro, setFiltro]         = useState<Filtro>(null)
  const [busca, setBusca]           = useState('')
  const [carrinho, dispatch]        = useReducer(carrinhoReducer, [])
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [drawerInfoAberto, setDrawerInfoAberto] = useState(false)
  const [podeReceber, setPodeReceber] = useState(true)
  const [scrolled, setScrolled]     = useState(false)
  const [etapa, setEtapa]           = useState<Etapa>('loja')
  const [pedidoConfirmado, setPedidoConfirmado] = useState<PedidoConfirmado | null>(null)
  const [cliente, setCliente]       = useState<Cliente | null>(null)
  const [enderecos, setEnderecos]   = useState<Endereco[]>([])

  // Sessão do cliente + endereços salvos (mantém o convidado funcionando)
  useEffect(() => {
    let ativo = true

    async function carregarCliente() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!ativo) return

      if (!user) {
        setCliente(null)
        setEnderecos([])
        return
      }

      setCliente({
        id: user.id,
        nome: (user.user_metadata?.nome as string) ?? '',
        email: user.email ?? '',
      })

      const { data } = await supabase
        .from('enderecos')
        .select('*')
        .eq('cliente_id', user.id)
        .order('padrao', { ascending: false })
        .order('criado_em', { ascending: true })
      if (ativo) setEnderecos((data as Endereco[]) ?? [])
    }

    carregarCliente()
    const { data: sub } = supabase.auth.onAuthStateChange(() => carregarCliente())
    return () => { ativo = false; sub.subscription.unsubscribe() }
  }, [])

  async function recarregarEnderecos() {
    if (!cliente) return
    const { data } = await supabase
      .from('enderecos')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('padrao', { ascending: false })
      .order('criado_em', { ascending: true })
    setEnderecos((data as Endereco[]) ?? [])
  }

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
        supabase.from('categorias').select('*').eq('loja_id', lojaData.id).order('ordem'),
        supabase
          .from('produtos')
          .select('*')
          .eq('loja_id', lojaData.id)
          .eq('disponivel', true)
          .order('nome'),
      ])

      setCategorias((cats as Categoria[]) ?? [])
      setProdutos((prods as Produto[]) ?? [])

      // Busca média de avaliações da loja (exibe se >= 5 avaliações)
      try {
        const { data: avalData, count } = await supabase
          .from('avaliacoes')
          .select('nota', { count: 'exact' })
          .eq('loja_id', lojaData.id)
        if (count && count >= 1 && avalData && avalData.length > 0) {
          const soma = (avalData as { nota: number }[]).reduce((acc, a) => acc + a.nota, 0)
          setMediaAvaliacoes({ media: soma / count, total: count })
        }
      } catch {
        // degrade silently
      }

      // Busca top 3 produtos mais vendidos (sem polling — atualiza na próxima visita)
      try {
        const { data: pedidosData } = await supabase
          .from('pedidos')
          .select('id')
          .eq('loja_id', lojaData.id)
          .neq('status', 'cancelado')

        const pedidoIds = (pedidosData ?? []).map((p: { id: string }) => p.id)

        if (pedidoIds.length > 0) {
          const { data: itensData } = await supabase
            .from('itens_pedido')
            .select('produto_id, quantidade')
            .in('pedido_id', pedidoIds)

          if (itensData && itensData.length > 0) {
            const totais = new Map<string, number>()
            for (const item of itensData as { produto_id: string; quantidade: number }[]) {
              totais.set(item.produto_id, (totais.get(item.produto_id) ?? 0) + Number(item.quantidade))
            }
            const top3 = [...totais.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([id]) => id)
            setTopProdutosIds(new Set(top3))
            setTopProdutosOrdem(top3)
          }
        }
      } catch {
        // degrade silently — sem badge em nenhum produto
      }
    }

    init()
  }, [slug])

  useEffect(() => {
    if (carrinho.length === 0) setDrawerAberto(false)
  }, [carrinho.length])

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 10) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* "Pedir de novo" (?repetir=<pedidoId>): recoloca no carrinho só os
     itens daquele pedido cujos produtos ainda estão disponíveis. */
  const repetirAplicadoRef = useRef(false)
  useEffect(() => {
    if (repetirAplicadoRef.current) return
    if (produtos.length === 0) return

    const repetir = new URLSearchParams(window.location.search).get('repetir')
    if (!repetir) return
    repetirAplicadoRef.current = true

    ;(async () => {
      const { data } = await supabase
        .from('itens_pedido')
        .select('produto_id,quantidade')
        .eq('pedido_id', repetir)

      const itens = (data ?? [])
        .map((it) => {
          const produto = produtos.find(p => p.id === it.produto_id)
          return produto ? { produto, quantidade: Number(it.quantidade) } : null
        })
        .filter((x): x is { produto: Produto; quantidade: number } => x !== null)

      if (itens.length > 0) {
        dispatch({ type: 'ADICIONAR_ITENS', itens })
        setDrawerAberto(true)
      }

      // Limpa o parâmetro da URL para não repetir em refresh
      window.history.replaceState(null, '', `/loja/${slug}`)
    })()
  }, [produtos, slug])

  // Verifica se a loja pode receber pedidos ao abrir o drawer
  useEffect(() => {
    if (!drawerAberto || !loja) return
    let ativo = true
    supabase
      .rpc('loja_pode_receber_pedidos', { p_loja_id: loja.id })
      .then(({ data }) => {
        if (ativo) setPodeReceber(data !== false)
      })
    return () => { ativo = false }
  }, [drawerAberto, loja])

  function handleContinuar() {
    setDrawerAberto(false)
    setEtapa('checkout')
  }

  function handlePedidoFeito(pedido: PedidoConfirmado) {
    dispatch({ type: 'LIMPAR' })
    setPedidoConfirmado(pedido)
    setEtapa('confirmacao')
  }

  function handleVoltarLoja() {
    setPedidoConfirmado(null)
    setEtapa('loja')
  }

  function handleLimparBusca() {
    setBusca('')
    setFiltro(null)
  }

  if (loja === undefined) return null

  if (loja === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center max-w-xs">
          <SearchX size={48} strokeWidth={1.25} className="text-ink-mute mx-auto mb-4" />
          <h1 className="text-[22px] font-bold text-ink">Loja não encontrada</h1>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">
            Verifique o endereço ou peça o link atualizado.
          </p>
        </div>
      </main>
    )
  }

  const entrega = labelEntrega(loja)

  const catsComProdutos = categorias.filter(c => produtos.some(p => p.categoria_id === c.id))
  const temOutros = produtos.some(p => !p.categoria_id)

  const chips: Array<{ id: Filtro; nome: string }> = [
    { id: null, nome: 'Todos' },
    ...catsComProdutos.map(c => ({ id: c.id, nome: c.nome })),
    ...(temOutros ? [{ id: 'outros' as string, nome: 'Outros' }] : []),
  ]

  // Busca no cliente (nome + descrição), ignorando acentos e maiúsculas.
  // Combina com o filtro de categoria via computarSecoes.
  const termoBusca = normalizar(busca.trim())
  const produtosVisiveis = termoBusca
    ? produtos.filter(p =>
        normalizar(p.nome).includes(termoBusca) ||
        (p.descricao ? normalizar(p.descricao).includes(termoBusca) : false)
      )
    : produtos
  const secoes = computarSecoes(categorias, produtosVisiveis, filtro)
  const totalItens = carrinho.length

  return (
    <div className="min-h-screen bg-bg">

      {/* ── Barra superior ───────────────────────── */}
      <TopBar
        width="reading"
        className={scrolled
          ? 'transition-all duration-200 !bg-surface/80 backdrop-blur-sm shadow-sm'
          : 'transition-all duration-200'
        }
        left={
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden border border-line bg-brand-100 flex items-center justify-center">
              {loja.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={loja.logo_url}
                  alt={loja.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-brand-700 select-none leading-none">
                  {loja.nome.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-base font-semibold text-ink truncate">{loja.nome}</p>
          </div>
        }
        right={
          <>
            {/* Alternador de tema */}
            <ThemeToggle />

            {/* Sininho de notificações */}
            <NotificationBell />

            {/* Carrinho com badge */}
            <button
              onClick={() => totalItens > 0 && setDrawerAberto(true)}
              aria-label={totalItens > 0
                ? `Ver carrinho (${totalItens} ${totalItens === 1 ? 'item' : 'itens'})`
                : 'Carrinho vazio'}
              className="relative w-11 h-11 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ShoppingCart size={22} strokeWidth={1.75} className="text-ink" />
              {totalItens > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-brand-500 text-surface text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {totalItens > 9 ? '9+' : totalItens}
                </span>
              )}
            </button>

            {/* Perfil: ícone circular, mesmo tamanho do carrinho */}
            <Link
              href={cliente ? '/conta' : `/entrar?redirect=${encodeURIComponent(`/loja/${slug}`)}`}
              aria-label={cliente ? 'Minha conta' : 'Entrar'}
              title={cliente ? 'Minha conta' : 'Entrar'}
              className="relative w-11 h-11 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <User size={22} strokeWidth={1.75} className="text-ink" />
              {cliente && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-brand-500 rounded-full border-2 border-surface" />
              )}
            </Link>
          </>
        }
      />

      {/* ── Hero da loja ─────────────────────────── */}
      <div className="bg-surface border-b border-line">
        <PageContainer size="reading" className="py-6">
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-bold text-ink flex-1 leading-tight">{loja.nome}</h1>

            {mediaAvaliacoes && loja.avaliacoes_ativas && (
              <Link
                href={`/loja/${loja.slug}/avaliacoes`}
                className="shrink-0 flex flex-col items-center bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="text-xl font-bold text-brand-700 leading-none">
                  {mediaAvaliacoes.media.toFixed(1)}
                </span>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star
                      key={i}
                      size={11}
                      strokeWidth={1.5}
                      className={i <= Math.round(mediaAvaliacoes.media) ? 'text-accent fill-accent' : 'text-line fill-transparent'}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-ink-mute mt-0.5 leading-none">
                  {mediaAvaliacoes.total} aval.
                </span>
              </Link>
            )}
          </div>

          {(() => {
            const s = calcularStatus(loja.horarios)
            if (!s) return null
            return s.tipo === 'aberto' ? (
              <p className="text-sm font-medium text-brand-600 mt-1">
                🟢 Aberto agora · fecha às {s.fecha}
              </p>
            ) : (
              <p className="text-sm font-medium text-danger mt-1">
                🔴 Fechado · abre {s.dia ? `${s.dia} ` : ''}{s.abre}
              </p>
            )
          })()}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {loja.endereco && (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                <MapPin size={14} strokeWidth={1.75} />
                {loja.endereco}
              </span>
            )}
            {loja.pedido_minimo != null && loja.pedido_minimo > 0 && (
              <span className="text-sm text-ink-soft">
                Pedido mínimo {formatarReal(loja.pedido_minimo)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
              <Truck size={14} strokeWidth={1.75} />
              {entrega}
            </span>
            {loja.tempo_entrega_min != null && (
              <span className="text-sm text-ink-soft">
                ⏱ {loja.tempo_entrega_min}–{loja.tempo_entrega_min + 15} min
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {loja.whatsapp && (
              <a
                href={`https://wa.me/${loja.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-line bg-surface text-sm font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <MessageCircle size={15} strokeWidth={1.75} />
                Falar no WhatsApp
              </a>
            )}

          </div>
        </PageContainer>
      </div>

      {/* ── Campo de busca (entre hero e pills) ─────── */}
      {produtos.length > 0 && (
        <div className="bg-bg border-b border-line">
          <div className="max-w-2xl mx-auto px-4 py-3">
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
                placeholder="Buscar produto..."
                aria-label="Buscar produto"
                className={[
                  'w-full h-11 rounded-full border border-line bg-surface pl-10 pr-4',
                  'text-sm text-ink placeholder:text-ink-mute',
                  'outline-none transition-shadow duration-150',
                  'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                ].join(' ')}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Chips de categoria ────────────────────── */}
      {chips.length > 1 && (
        <div className="sticky top-14 z-20 bg-surface border-b border-line">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map(chip => (
                <Chip
                  key={chip.id ?? 'todos'}
                  selected={filtro === chip.id}
                  variant="solid"
                  onClick={() => {
                    setFiltro(chip.id)
                    if (chip.id !== null) {
                      setTimeout(() => {
                        document.getElementById(`cat-${chip.id}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 50)
                    }
                  }}
                >
                  {chip.nome}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Conteúdo principal ───────────────────── */}
      <main className="pb-28">
        <PageContainer size="reading">

          {produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ShoppingBag size={48} strokeWidth={1.25} className="text-ink-mute mb-4" />
              <p className="text-base font-semibold text-ink">Nenhum produto disponível</p>
              <p className="text-sm text-ink-soft mt-1">Esta loja ainda não adicionou produtos.</p>
            </div>
          ) : secoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <SearchX size={48} strokeWidth={1.25} className="text-ink-mute mb-4" />
              <p className="text-base font-semibold text-ink">
                {busca ? `Nada encontrado para "${busca}"` : 'Nenhum produto encontrado'}
              </p>
              <p className="text-sm text-ink-soft mt-1 mb-5">Tente outro termo ou categoria.</p>
              <Button variant="secondary" onClick={handleLimparBusca}>
                Limpar busca e filtro
              </Button>
            </div>
          ) : (
            <>
              {!busca && !filtro && topProdutosOrdem.length > 0 && (
                <SecaoDestaques
                  produtos={produtos}
                  topProdutosOrdem={topProdutosOrdem}
                  carrinho={carrinho}
                  dispatch={dispatch}
                />
              )}
              {secoes.map(secao => (
                <section key={secao.id} id={`cat-${secao.id}`} className="mt-6 scroll-mt-32">
                  <SectionTitle className="mb-3">{secao.nome}</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {secao.itens.map(p => (
                      <CardProduto
                        key={p.id}
                        produto={p}
                        itemCarrinho={carrinho.find(i => i.id === p.id)}
                        dispatch={dispatch}
                        isMaisVendido={topProdutosIds.has(p.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </PageContainer>
      </main>

      {/* ── Barra de carrinho ────────────────────── */}
      <BarraCarrinho itens={carrinho} onAbrir={() => setDrawerAberto(true)} />

      {/* ── Drawer de informações da loja ────────── */}
      {drawerInfoAberto && (
        <DrawerInfo loja={loja} onFechar={() => setDrawerInfoAberto(false)} />
      )}

      {/* ── Drawer do carrinho ───────────────────── */}
      {drawerAberto && (
        <DrawerCarrinho
          itens={carrinho}
          loja={loja}
          dispatch={dispatch}
          onFechar={() => setDrawerAberto(false)}
          onContinuar={handleContinuar}
          podeReceber={podeReceber}
        />
      )}

      {/* ── Tela de checkout ─────────────────────── */}
      {etapa === 'checkout' && (
        <TelaCheckout
          carrinho={carrinho}
          loja={loja}
          cliente={cliente}
          enderecos={enderecos}
          onVoltar={() => { setEtapa('loja'); setDrawerAberto(true) }}
          onPedidoFeito={handlePedidoFeito}
          onEnderecoSalvo={recarregarEnderecos}
        />
      )}

      {/* ── Tela de confirmação ──────────────────── */}
      {etapa === 'confirmacao' && pedidoConfirmado && (
        <TelaConfirmacao
          pedido={pedidoConfirmado}
          loja={loja}
          cliente={cliente}
          onVoltarLoja={handleVoltarLoja}
        />
      )}
    </div>
  )
}
