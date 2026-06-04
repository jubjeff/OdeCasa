'use client'

import { useEffect, useReducer, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ShoppingCart, MapPin, Truck, ImageIcon, ShoppingBag, SearchX,
  Minus, Plus, X, AlertCircle, ArrowLeft, CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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

type AcaoCarrinho =
  | { type: 'ADICIONAR'; produto: Produto }
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
  onVoltar: () => void
  onPedidoFeito: (pedido: PedidoConfirmado) => void
}

function TelaCheckout({ carrinho, loja, onVoltar, onPedidoFeito }: TelaCheckoutProps) {
  const subtotal = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const taxa = loja.taxa_entrega
  const total = subtotal + taxa
  const minimo = loja.pedido_minimo ?? 0
  const faltaMinimo = minimo > 0 && subtotal < minimo ? minimo - subtotal : 0

  const [form, setForm] = useState<FormCheckout>({
    nome: '',
    telefone: '',
    endereco: '',
    observacoes: '',
    forma_pagamento: 'pix',
    troco_para: '',
  })
  const [erros, setErros] = useState<Partial<Record<keyof FormCheckout | 'geral', string>>>({})
  const [enviando, setEnviando] = useState(false)

  function set(campo: keyof FormCheckout, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    setErros(e => ({ ...e, [campo]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const novosErros: typeof erros = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe seu nome'
    if (!form.telefone.trim()) novosErros.telefone = 'Informe seu WhatsApp ou telefone'
    if (!form.endereco.trim()) novosErros.endereco = 'Informe o endereço de entrega'

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
        cliente_id: null,
        nome_cliente: form.nome.trim(),
        telefone_cliente: form.telefone.trim(),
        endereco_entrega: form.endereco.trim(),
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
                  onChange={e => set('telefone', e.target.value)}
                  autoComplete="tel"
                />
                {erros.telefone && <p className="text-xs text-danger mt-1">{erros.telefone}</p>}
              </div>
            </div>

            {/* Entrega */}
            <div className="bg-surface rounded-xl px-4 py-4 shadow-sm space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Entrega</h2>

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
  onVoltarLoja: () => void
}

function TelaConfirmacao({ pedido, loja, onVoltarLoja }: TelaConfirmacaoProps) {
  const idCurto = pedido.id.slice(0, 8).toUpperCase()

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
  const [carrinho, dispatch]        = useReducer(carrinhoReducer, [])
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [etapa, setEtapa]           = useState<Etapa>('loja')
  const [pedidoConfirmado, setPedidoConfirmado] = useState<PedidoConfirmado | null>(null)

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

  const secoes = computarSecoes(categorias, produtos, filtro)
  const totalItens = carrinho.length

  return (
    <div className="min-h-screen bg-bg">

      {/* ── Barra superior fixa ──────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {loja.logo_url && (
              <img
                src={loja.logo_url}
                alt={loja.nome}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-line"
              />
            )}
            <p className="text-base font-semibold text-ink truncate">{loja.nome}</p>
          </div>

          <button
            onClick={() => totalItens > 0 && setDrawerAberto(true)}
            aria-label={totalItens > 0
              ? `Ver carrinho (${totalItens} ${totalItens === 1 ? 'item' : 'itens'})`
              : 'Carrinho vazio'}
            className="relative shrink-0 w-11 h-11 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ShoppingCart size={22} strokeWidth={1.75} className="text-ink" />
            {totalItens > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-brand-500 text-surface text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {totalItens > 9 ? '9+' : totalItens}
              </span>
            )}
          </button>
        </div>
      </header>

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
      <main className="max-w-2xl mx-auto px-4 pb-28">
        {secoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag size={48} strokeWidth={1.25} className="text-ink-mute mb-4" />
            <p className="text-base font-semibold text-ink">Nenhum produto disponível</p>
            <p className="text-sm text-ink-soft mt-1">Esta loja ainda não tem produtos.</p>
          </div>
        ) : (
          secoes.map(secao => (
            <section key={secao.id} id={`cat-${secao.id}`} className="mt-6 scroll-mt-36">
              <h2 className="text-[18px] font-semibold text-ink mb-3">{secao.nome}</h2>
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
          onVoltar={() => { setEtapa('loja'); setDrawerAberto(true) }}
          onPedidoFeito={handlePedidoFeito}
        />
      )}

      {/* ── Tela de confirmação ──────────────────── */}
      {etapa === 'confirmacao' && pedidoConfirmado && (
        <TelaConfirmacao
          pedido={pedidoConfirmado}
          loja={loja}
          onVoltarLoja={handleVoltarLoja}
        />
      )}
    </div>
  )
}
