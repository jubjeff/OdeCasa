'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ShoppingCart, MapPin, Truck, ImageIcon, ShoppingBag, SearchX, Search,
  Minus, Plus, X, AlertCircle, ArrowLeft, CheckCircle2, Copy, Check, User, Bell,
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
  logo_url: string | null
  chave_pix: string | null
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
  endereco: string
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
}

/* ── Helpers ─────────────────────────────────────── */

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
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

interface CardProdutoProps {
  produto: Produto
  itemCarrinho: ItemCarrinho | undefined
  dispatch: React.Dispatch<AcaoCarrinho>
}

function CardProduto({ produto, itemCarrinho, dispatch }: CardProdutoProps) {
  return (
    <Card bodyClassName="p-0">
      <div className="aspect-[4/3] overflow-hidden bg-brand-50">
        {produto.foto_url ? (
          <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} strokeWidth={1.25} className="text-brand-200" />
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-semibold text-ink leading-snug">{produto.nome}</p>

        {produto.descricao && (
          <p className="text-xs text-ink-mute mt-1 line-clamp-2 leading-relaxed">
            {produto.descricao}
          </p>
        )}

        <p className="text-[15px] font-bold text-brand-700 mt-2">
          {formatarReal(produto.preco)}
          <span className="text-xs font-normal text-ink-mute"> / {labelUnidade(produto.unidade)}</span>
        </p>

        <div className="mt-3 flex justify-center">
          {itemCarrinho ? (
            <ControleQtd item={itemCarrinho} dispatch={dispatch} size="sm" />
          ) : (
            <Button
              variant="secondary"
              className="w-full !min-h-[40px] text-xs px-2"
              onClick={() => dispatch({ type: 'ADICIONAR', produto })}
            >
              Adicionar
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ── Drawer do carrinho ──────────────────────────── */

interface DrawerCarrinhoProps {
  itens: ItemCarrinho[]
  loja: Loja
  dispatch: React.Dispatch<AcaoCarrinho>
  onFechar: () => void
  onContinuar: () => void
}

function DrawerCarrinho({ itens, loja, dispatch, onFechar, onContinuar }: DrawerCarrinhoProps) {
  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const taxa = loja.taxa_entrega
  const total = subtotal + taxa
  const minimo = loja.pedido_minimo ?? 0
  const faltaMinimo = minimo > 0 && subtotal < minimo ? minimo - subtotal : 0
  const podeContinuar = faltaMinimo === 0

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

          {faltaMinimo > 0 && (
            <div className="flex items-start gap-2 bg-accent/10 text-accent rounded-lg p-3 mb-4 text-sm leading-snug">
              <AlertCircle size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              <span>Faltam {formatarReal(faltaMinimo)} para o pedido mínimo</span>
            </div>
          )}

          <Button variant="primary" className="w-full" disabled={!podeContinuar} onClick={onContinuar}>
            Continuar
          </Button>
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
    <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-4 pt-3 pointer-events-none">
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

function TelaCheckout({
  carrinho, loja, cliente, enderecos, onVoltar, onPedidoFeito, onEnderecoSalvo,
}: TelaCheckoutProps) {
  const subtotal = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const taxa = loja.taxa_entrega
  const total = subtotal + taxa
  const minimo = loja.pedido_minimo ?? 0
  const faltaMinimo = minimo > 0 && subtotal < minimo ? minimo - subtotal : 0

  const temEnderecosSalvos = cliente !== null && enderecos.length > 0
  const enderecoPadrao = enderecos.find(e => e.padrao) ?? enderecos[0]

  const [form, setForm] = useState<FormCheckout>({
    nome: cliente?.nome ?? '',
    telefone: '',
    endereco: '',
    observacoes: '',
    forma_pagamento: 'pix',
    troco_para: '',
  })
  // id do endereço salvo escolhido; null = digitar um novo endereço
  const [enderecoSelId, setEnderecoSelId] = useState<string | null>(
    temEnderecosSalvos ? enderecoPadrao.id : null
  )
  const [salvarEndereco, setSalvarEndereco] = useState(false)
  const [erros, setErros] = useState<Partial<Record<keyof FormCheckout | 'geral', string>>>({})
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  function set(campo: keyof FormCheckout, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    setErros(e => ({ ...e, [campo]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Endereço escolhido: salvo (logado) ou digitado
    const usandoSalvo = cliente !== null && enderecoSelId !== null
    const enderecoSalvo = usandoSalvo
      ? enderecos.find(e => e.id === enderecoSelId)
      : undefined
    const enderecoEntrega = enderecoSalvo
      ? composeEndereco(enderecoSalvo)
      : form.endereco.trim()

    const novosErros: typeof erros = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe seu nome'
    if (!form.telefone.trim()) novosErros.telefone = 'Informe seu WhatsApp ou telefone'
    else if (form.telefone.replace(/\D/g, '').length < 10) novosErros.telefone = 'Número incompleto'
    if (!enderecoEntrega) novosErros.endereco = 'Informe o endereço de entrega'

    if (form.forma_pagamento === 'dinheiro' && form.troco_para.trim()) {
      const troco = parseFloat(form.troco_para.replace(',', '.'))
      if (isNaN(troco) || troco < total) {
        novosErros.troco_para = `O valor deve ser maior ou igual ao total (${formatarReal(total)})`
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
        taxa_entrega: taxa,
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

      // Cliente logado optou por salvar o endereço novo digitado
      if (cliente && !usandoSalvo && salvarEndereco && form.endereco.trim()) {
        await supabase.from('enderecos').insert({
          cliente_id: cliente.id,
          endereco: form.endereco.trim(),
          padrao: enderecos.length === 0,
        })
        onEnderecoSalvo()
      }

      onPedidoFeito({
        id: pedidoId,
        nome_cliente: form.nome.trim(),
        itens: carrinho,
        subtotal: +subtotal.toFixed(2),
        taxa_entrega: taxa,
        total: +total.toFixed(2),
        forma_pagamento: form.forma_pagamento,
        troco_para: trocoPara,
        observacoes: form.observacoes.trim() || null,
      })
    } catch (err) {
      console.error('[OdeCasa] Erro ao finalizar pedido:', err)
      setErros(e => ({ ...e, geral: 'Não foi possível enviar o pedido. Tente novamente.' }))
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
                  <span className={taxa === 0 ? 'text-brand-600 font-medium' : ''}>
                    {taxa === 0 ? 'Grátis' : formatarReal(taxa)}
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
                </div>
              )}

              {/* Campo de endereço novo: convidado, logado sem endereços, ou logado escolhendo "novo" */}
              {(!temEnderecosSalvos || enderecoSelId === null) && (
                <div className="space-y-3">
                  <div>
                    <Input
                      id="endereco"
                      label="Endereço completo"
                      placeholder="Rua, número, bairro, complemento"
                      value={form.endereco}
                      onChange={e => set('endereco', e.target.value)}
                      autoComplete="street-address"
                    />
                    {erros.endereco && <p className="text-xs text-danger mt-1">{erros.endereco}</p>}
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

            {/* Botão de envio */}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={enviando || faltaMinimo > 0}
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

function TelaConfirmacao({ pedido, loja, cliente, onVoltarLoja }: TelaConfirmacaoProps) {
  const router = useRouter()
  const idCurto = pedido.id.slice(0, 8).toUpperCase()

  // Convidado: convite para criar conta e acompanhar os pedidos
  const [mostrarConvite, setMostrarConvite] = useState(!cliente)

  // Cliente logado: lembra que dá pra acompanhar o status em Minha conta
  const avisou = useRef(false)
  useEffect(() => {
    if (!cliente || avisou.current) return
    avisou.current = true
    toast('Acompanhe seu pedido em Minha conta', {
      description: 'O status atualiza em tempo real por lá.',
      icon: <Bell size={18} strokeWidth={1.75} />,
      duration: 6000,
      action: { label: 'Ver', onClick: () => router.push('/conta') },
    })
  }, [cliente, router])

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col items-center">

        {/* Ícone de sucesso */}
        <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center mb-5">
          <CheckCircle2 size={40} strokeWidth={1.5} className="text-brand-500" />
        </div>

        <h1 className="text-[26px] font-bold text-ink text-center">Pedido recebido!</h1>
        <p className="text-sm text-ink-soft mt-2 text-center">
          {loja.nome} vai preparar seu pedido em breve.
        </p>

        <div className="mt-1">
          <span className="inline-block bg-brand-50 text-brand-700 text-xs font-semibold rounded-full px-3 py-1">
            #{idCurto}
          </span>
        </div>

        {/* Resumo */}
        <div className="w-full mt-8 bg-surface rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-[15px] font-semibold text-ink">Resumo</h2>
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
            <div className="flex justify-between text-base font-bold text-ink pt-1 border-t border-line">
              <span>Total</span>
              <span>{formatarReal(pedido.total)}</span>
            </div>
          </div>

          <div className="px-4 pb-4 space-y-1">
            <div className="flex justify-between text-sm">
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
              <div className="text-sm text-ink-soft mt-2 pt-2 border-t border-line">
                <span className="font-medium text-ink">Obs:</span> {pedido.observacoes}
              </div>
            )}
          </div>
        </div>

        <Button variant="secondary" className="w-full mt-6" onClick={onVoltarLoja}>
          Voltar à loja
        </Button>
      </div>

      {/* Convidado: convite para criar conta e acompanhar os pedidos */}
      {mostrarConvite && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="convite-titulo"
          onClick={() => setMostrarConvite(false)}
        >
          <div
            className="w-full max-w-sm bg-surface rounded-xl shadow-lg p-6 relative"
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
              Crie sua conta para acompanhar o status dos seus pedidos em tempo real,
              direto em Minha conta.
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
  const [filtro, setFiltro]         = useState<Filtro>(null)
  const [busca, setBusca]           = useState('')
  const [carrinho, dispatch]        = useReducer(carrinhoReducer, [])
  const [drawerAberto, setDrawerAberto] = useState(false)
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

  useEffect(() => {
    if (carrinho.length === 0) setDrawerAberto(false)
  }, [carrinho.length])

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

  const entrega =
    loja.taxa_entrega === 0
      ? 'Entrega grátis'
      : `Entrega ${formatarReal(loja.taxa_entrega)}`

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
        left={
          <div className="flex items-center gap-2.5 min-w-0">
            {loja.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loja.logo_url}
                alt={loja.nome}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-line"
              />
            )}
            <p className="text-base font-semibold text-ink truncate">{loja.nome}</p>
          </div>
        }
        right={
          <>
            {/* Sininho de notificações (aparece só para cliente logado) */}
            <NotificationBell />

            {/* Conta do cliente: Entrar quando deslogado, Minha conta quando logado */}
            {cliente ? (
              <Link
                href="/conta"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <User size={16} strokeWidth={1.75} />
                Minha conta
              </Link>
            ) : (
              <Link
                href={`/entrar?redirect=${encodeURIComponent(`/loja/${slug}`)}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <User size={16} strokeWidth={1.75} />
                Entrar
              </Link>
            )}

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
          </>
        }
      />

      {/* ── Cabeçalho da loja ────────────────────── */}
      <div className="bg-surface border-b border-line">
        <PageContainer size="reading" className="py-5">
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
        </PageContainer>
      </div>

      {/* ── Chips de categoria ────────────────────── */}
      {chips.length > 1 && (
        <div className="sticky top-14 z-30 bg-surface border-b border-line">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map(chip => (
                <Chip
                  key={chip.id ?? 'todos'}
                  selected={filtro === chip.id}
                  onClick={() => setFiltro(chip.id)}
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

          {/* Busca por nome/descrição — no cliente, em tempo real */}
          {produtos.length > 0 && (
            <div className="pt-4">
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
                  placeholder="Buscar produto"
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
          )}

          {produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ShoppingBag size={48} strokeWidth={1.25} className="text-ink-mute mb-4" />
              <p className="text-base font-semibold text-ink">Nenhum produto disponível</p>
              <p className="text-sm text-ink-soft mt-1">Esta loja ainda não tem produtos.</p>
            </div>
          ) : secoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <SearchX size={48} strokeWidth={1.25} className="text-ink-mute mb-4" />
              <p className="text-base font-semibold text-ink">Nenhum produto encontrado</p>
              <p className="text-sm text-ink-soft mt-1 mb-5">Tente outro termo ou categoria.</p>
              <Button variant="secondary" onClick={handleLimparBusca}>
                Limpar busca e filtro
              </Button>
            </div>
          ) : (
            secoes.map(secao => (
              <section key={secao.id} id={`cat-${secao.id}`} className="mt-6 scroll-mt-36">
                <SectionTitle className="mb-3">{secao.nome}</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  {secao.itens.map(p => (
                    <CardProduto
                      key={p.id}
                      produto={p}
                      itemCarrinho={carrinho.find(i => i.id === p.id)}
                      dispatch={dispatch}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </PageContainer>
      </main>

      {/* ── Barra de carrinho ────────────────────── */}
      <BarraCarrinho itens={carrinho} onAbrir={() => setDrawerAberto(true)} />

      {/* ── Drawer do carrinho ───────────────────── */}
      {drawerAberto && (
        <DrawerCarrinho
          itens={carrinho}
          loja={loja}
          dispatch={dispatch}
          onFechar={() => setDrawerAberto(false)}
          onContinuar={handleContinuar}
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
