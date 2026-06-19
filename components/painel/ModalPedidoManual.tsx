'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Search, Store, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import type { OrderStatus } from '@/components/ui/StatusBadge'

/* ── Tipos ──────────────────────────────────────────────────────────── */

interface Produto {
  id: string
  nome: string
  preco: number
  unidade: 'un' | 'kg'
}

interface ItemCarrinho {
  produto: Produto
  quantidade: number
}

interface Props {
  lojaId: string
  onFechar: () => void
  onCriado: () => void
}

/* ── Constantes ─────────────────────────────────────────────────────── */

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro',       label: 'Dinheiro'  },
  { value: 'pix',            label: 'Pix'       },
  { value: 'cartao_entrega', label: 'Cartão'    },
]

const STATUS_OPCOES: { value: 'entregue' | 'preparando'; label: string }[] = [
  { value: 'entregue',   label: 'Entregue — venda já feita'     },
  { value: 'preparando', label: 'Preparando — encomenda futura' },
]

/* ── Helpers ────────────────────────────────────────────────────────── */

function formatarReal(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function qtdLabel(qtd: number, unidade: string) {
  return unidade === 'kg' ? `${qtd.toFixed(1)} kg` : String(qtd)
}

/* ── Componente ─────────────────────────────────────────────────────── */

export function ModalPedidoManual({ lojaId, onFechar, onCriado }: Props) {
  const [produtos, setProdutos]           = useState<Produto[]>([])
  const [taxaLoja, setTaxaLoja]           = useState(0)
  const [busca, setBusca]                 = useState('')
  const [carrinho, setCarrinho]           = useState<Map<string, ItemCarrinho>>(new Map())

  const [nomeCliente, setNomeCliente]     = useState('')
  const [telefone, setTelefone]           = useState('')
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [statusInicial, setStatusInicial] = useState<'entregue' | 'preparando'>('entregue')
  const [temEntrega, setTemEntrega]       = useState(false)
  const [enderecoEntrega, setEnderecoEntrega] = useState('')

  const [salvando, setSalvando]           = useState(false)

  /* ── Carga inicial ────────────────────────────────────────────────── */

  useEffect(() => {
    async function carregar() {
      const [{ data: prods }, { data: loja }] = await Promise.all([
        supabase
          .from('produtos')
          .select('id, nome, preco, unidade')
          .eq('loja_id', lojaId)
          .eq('disponivel', true)
          .order('nome'),
        supabase.from('lojas').select('taxa_entrega').eq('id', lojaId).single(),
      ])
      if (prods) setProdutos(prods as Produto[])
      if (loja)  setTaxaLoja((loja as { taxa_entrega: number }).taxa_entrega ?? 0)
    }
    carregar()
  }, [lojaId])

  /* ── Produtos filtrados por busca ─────────────────────────────────── */

  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return produtos
    const q = busca.toLowerCase()
    return produtos.filter(p => p.nome.toLowerCase().includes(q))
  }, [produtos, busca])

  /* ── Stepper ──────────────────────────────────────────────────────── */

  function ajustarQuantidade(produto: Produto, delta: number) {
    setCarrinho(prev => {
      const mapa   = new Map(prev)
      const atual  = mapa.get(produto.id)
      const passo  = produto.unidade === 'kg' ? 0.5 : 1
      const minimo = passo

      if (!atual) {
        if (delta > 0) mapa.set(produto.id, { produto, quantidade: minimo })
      } else {
        const novaQtd = Math.round((atual.quantidade + delta * passo) * 10) / 10
        if (novaQtd < minimo) mapa.delete(produto.id)
        else mapa.set(produto.id, { ...atual, quantidade: novaQtd })
      }
      return mapa
    })
  }

  /* ── Totais ───────────────────────────────────────────────────────── */

  const itens     = useMemo(() => Array.from(carrinho.values()), [carrinho])
  const subtotal  = itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0)
  const taxa      = temEntrega ? taxaLoja : 0
  const total     = subtotal + taxa

  /* ── Submit ───────────────────────────────────────────────────────── */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (itens.length === 0) {
      toast.error('Adicione ao menos um produto ao pedido.')
      return
    }

    setSalvando(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Sessão expirada. Recarregue a página.')
      setSalvando(false)
      return
    }

    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .insert({
        loja_id:          lojaId,
        nome_cliente:     nomeCliente.trim() || 'Cliente do balcão',
        telefone_cliente: telefone.trim(),
        endereco_entrega: temEntrega ? enderecoEntrega.trim() : '',
        status:           statusInicial as OrderStatus,
        forma_pagamento:  formaPagamento,
        subtotal,
        taxa_entrega:     taxa,
        total,
        origem:           'manual',
        criado_por:       user.id,
      })
      .select('id')
      .single()

    if (errPedido || !pedido) {
      toast.error('Não foi possível registrar o pedido. Tente novamente.')
      setSalvando(false)
      return
    }

    const payload = itens.map(i => ({
      pedido_id:      pedido.id,
      produto_id:     i.produto.id,
      nome_produto:   i.produto.nome,
      preco_unitario: i.produto.preco,
      unidade:        i.produto.unidade,
      quantidade:     i.quantidade,
      subtotal:       Math.round(i.produto.preco * i.quantidade * 100) / 100,
    }))

    const { error: errItens } = await supabase.from('itens_pedido').insert(payload)

    if (errItens) {
      toast.error('Pedido criado mas os itens não foram salvos. Contate o suporte.')
    } else {
      toast.success('Pedido manual registrado!')
      onCriado()
      onFechar()
    }
    setSalvando(false)
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Novo pedido manual">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm cursor-default"
        onClick={onFechar}
        aria-label="Fechar"
        tabIndex={-1}
      />

      {/* Painel lateral */}
      <form
        onSubmit={handleSubmit}
        className="relative ml-auto w-full max-w-lg h-full bg-surface flex flex-col shadow-lg overflow-hidden"
      >
        {/* Cabeçalho fixo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <Store size={18} strokeWidth={1.75} className="text-brand-500" />
            <h2 className="text-[18px] font-semibold text-ink">Novo pedido manual</h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-9 h-9 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors duration-150"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-5 space-y-6">

            {/* ── Produtos ────────────────────────────────────────────── */}
            <section>
              <p className="text-sm font-semibold text-ink mb-3">Produtos</p>

              {/* Campo de busca */}
              <div className="relative mb-3">
                <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar produto…"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-line bg-bg text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                />
              </div>

              {/* Lista de produtos */}
              <div className="space-y-1 max-h-52 overflow-y-auto rounded-xl border border-line bg-bg">
                {produtos.length === 0 ? (
                  <p className="text-sm text-ink-mute text-center py-6">Carregando produtos…</p>
                ) : produtosFiltrados.length === 0 ? (
                  <p className="text-sm text-ink-mute text-center py-6">Nenhum produto encontrado</p>
                ) : produtosFiltrados.map(p => {
                  const item = carrinho.get(p.id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand-50 transition-colors duration-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{p.nome}</p>
                        <p className="text-xs font-semibold text-brand-700">{formatarReal(p.preco)}/{p.unidade}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => ajustarQuantidade(p, -1)}
                          disabled={!item}
                          aria-label={`Remover ${p.nome}`}
                          className="w-7 h-7 rounded-full border border-line flex items-center justify-center text-ink-mute hover:text-brand-700 hover:border-brand-300 disabled:opacity-30 transition-colors duration-100"
                        >
                          <Minus size={13} strokeWidth={2} />
                        </button>
                        <span className="text-sm font-semibold text-ink w-8 text-center tabular-nums">
                          {item ? (p.unidade === 'kg' ? item.quantidade.toFixed(1) : item.quantidade) : '0'}
                        </span>
                        <button
                          type="button"
                          onClick={() => ajustarQuantidade(p, 1)}
                          aria-label={`Adicionar ${p.nome}`}
                          className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white hover:bg-brand-600 transition-colors duration-100"
                        >
                          <Plus size={13} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Resumo do carrinho ───────────────────────────────────── */}
            {itens.length > 0 && (
              <section className="bg-bg rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-ink mb-1">Resumo</p>
                {itens.map(item => (
                  <div key={item.produto.id} className="flex justify-between text-sm">
                    <span className="text-ink-soft">
                      {item.produto.nome}
                      <span className="text-ink-mute ml-1">× {qtdLabel(item.quantidade, item.produto.unidade)}</span>
                    </span>
                    <span className="font-medium text-ink tabular-nums">
                      {formatarReal(item.produto.preco * item.quantidade)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-line pt-2 space-y-1">
                  <div className="flex justify-between text-sm text-ink-soft">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatarReal(subtotal)}</span>
                  </div>
                  {taxa > 0 && (
                    <div className="flex justify-between text-sm text-ink-soft">
                      <span>Taxa de entrega</span>
                      <span className="tabular-nums">{formatarReal(taxa)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-brand-700">
                    <span>Total</span>
                    <span className="tabular-nums">{formatarReal(total)}</span>
                  </div>
                </div>
              </section>
            )}

            {/* ── Dados do cliente ─────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="text-sm font-semibold text-ink">Dados do cliente</p>
              <Input
                id="nome-cliente"
                label="Nome do cliente"
                placeholder="Cliente do balcão"
                value={nomeCliente}
                onChange={e => setNomeCliente(e.target.value)}
                autoComplete="off"
              />
              <Input
                id="telefone-manual"
                label="Telefone (opcional)"
                placeholder="(11) 99999-0000"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                type="tel"
                autoComplete="off"
              />
            </section>

            {/* ── Pagamento ────────────────────────────────────────────── */}
            <section>
              <label htmlFor="forma-pagamento" className="block text-sm font-medium text-ink mb-1.5">
                Forma de pagamento
              </label>
              <select
                id="forma-pagamento"
                value={formaPagamento}
                onChange={e => setFormaPagamento(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
              >
                {FORMAS_PAGAMENTO.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </section>

            {/* ── Entrega (opcional) ───────────────────────────────────── */}
            <section className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={temEntrega}
                  onClick={() => setTemEntrega(v => !v)}
                  className={[
                    'relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    temEntrega ? 'bg-brand-500' : 'bg-line',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                    temEntrega ? 'translate-x-5' : 'translate-x-1',
                  ].join(' ')} />
                </button>
                <span className="text-sm text-ink-soft">Esse pedido também terá entrega?</span>
              </label>

              {temEntrega && (
                <Input
                  id="endereco-entrega-manual"
                  label="Endereço de entrega"
                  placeholder="Rua, número, bairro…"
                  value={enderecoEntrega}
                  onChange={e => setEnderecoEntrega(e.target.value)}
                />
              )}
            </section>

            {/* ── Status inicial ───────────────────────────────────────── */}
            <section>
              <label htmlFor="status-inicial" className="block text-sm font-medium text-ink mb-1.5">
                Status inicial
              </label>
              <select
                id="status-inicial"
                value={statusInicial}
                onChange={e => setStatusInicial(e.target.value as 'entregue' | 'preparando')}
                className="w-full h-12 px-3 rounded-xl border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
              >
                {STATUS_OPCOES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </section>

          </div>
        </div>

        {/* Rodapé fixo com total e botão */}
        <div className="px-5 py-4 border-t border-line bg-surface shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-ink-soft">Total do pedido</span>
            <span className="text-lg font-bold text-brand-700 tabular-nums">{formatarReal(total)}</span>
          </div>
          <Button
            type="submit"
            disabled={salvando || itens.length === 0}
            className="w-full"
          >
            {salvando ? 'Registrando…' : 'Registrar pedido'}
          </Button>
        </div>
      </form>
    </div>
  )
}
