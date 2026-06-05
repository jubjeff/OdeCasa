'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, MapPin, Plus, Pencil, Trash2, Star, LogOut,
  ChevronDown, ChevronUp, ShoppingBag, Repeat,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge, type OrderStatus } from '@/components/ui/StatusBadge'
import { TopBar } from '@/components/ui/TopBar'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { IconButton } from '@/components/ui/IconButton'

/* ── Tipos ───────────────────────────────────────── */

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

interface FormEndereco {
  apelido: string
  endereco: string
  complemento: string
  referencia: string
}

const FORM_VAZIO: FormEndereco = {
  apelido: '',
  endereco: '',
  complemento: '',
  referencia: '',
}

/* ── Pedidos: tipos e helpers ─────────────────────── */

interface Pedido {
  id: string
  status: OrderStatus
  total: number
  criado_em: string
  forma_pagamento: string
  endereco_entrega: string
  loja_nome: string
  loja_slug: string
}

interface ItemPedido {
  pedido_id: string
  nome_produto: string
  preco_unitario: number
  unidade: string
  quantidade: number
  subtotal: number
}

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatarQtd(qtd: number, unidade: string): string {
  if (unidade === 'kg')
    return qtd.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return String(qtd)
}

const LABEL_UNIDADE: Record<string, string> = {
  un: 'un.', kg: 'kg', g: 'g', maco: 'maço', duzia: 'dz.', l: 'L', bandeja: 'bdj.',
}
function labelUnidade(un: string): string {
  return LABEL_UNIDADE[un] ?? un
}

const LABEL_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao_entrega: 'Cartão na entrega',
}

/* ── Card de pedido (histórico) ───────────────────── */

interface PedidoCardProps {
  pedido: Pedido
  itens: ItemPedido[] | undefined
  loadingItens: boolean
  expandido: boolean
  onToggle: () => void
}

function PedidoCard({ pedido, itens, loadingItens, expandido, onToggle }: PedidoCardProps) {
  return (
    <div className="bg-surface rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        aria-expanded={expandido}
        className="w-full text-left px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink truncate">{pedido.loja_nome}</p>
          <StatusBadge status={pedido.status} />
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <p className="text-xs text-ink-mute">{formatarData(pedido.criado_em)}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold text-brand-700">{formatarReal(pedido.total)}</span>
            {expandido
              ? <ChevronUp size={15} strokeWidth={2} className="text-ink-mute" />
              : <ChevronDown size={15} strokeWidth={2} className="text-ink-mute" />}
          </div>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-line px-4 pb-4 pt-3 space-y-4">
          {/* Itens */}
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">Itens</p>
            {loadingItens ? (
              <p className="text-xs text-ink-mute">Carregando…</p>
            ) : itens && itens.length > 0 ? (
              <div className="space-y-1.5">
                {itens.map((item, i) => (
                  <div key={i} className="flex justify-between items-baseline gap-2">
                    <span className="text-sm text-ink flex-1 min-w-0 truncate">
                      {item.nome_produto}
                      <span className="text-ink-mute ml-1">
                        × {formatarQtd(item.quantidade, item.unidade)} {labelUnidade(item.unidade)}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-ink shrink-0">
                      {formatarReal(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-mute">Sem itens registrados</p>
            )}
          </div>

          {/* Entrega e pagamento */}
          <div className="space-y-2 border-t border-line pt-3">
            <div className="flex items-start gap-2">
              <MapPin size={13} strokeWidth={1.75} className="text-ink-mute shrink-0 mt-0.5" />
              <p className="text-sm text-ink-soft leading-snug">{pedido.endereco_entrega}</p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Pagamento</span>
              <span className="text-ink font-medium">
                {LABEL_PAGAMENTO[pedido.forma_pagamento] ?? pedido.forma_pagamento}
              </span>
            </div>
          </div>

          {/* Pedir de novo */}
          {pedido.loja_slug && (
            <Link
              href={`/loja/${pedido.loja_slug}?repetir=${pedido.id}`}
              className="flex items-center justify-center gap-2 w-full min-h-[40px] rounded-md text-xs font-semibold px-3 bg-surface border border-line text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Repeat size={14} strokeWidth={1.75} />
              Pedir de novo
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Formulário de endereço (adicionar/editar) ───── */

interface EnderecoFormProps {
  inicial: FormEndereco
  salvando: boolean
  onSalvar: (valores: FormEndereco) => void
  onCancelar: () => void
}

function EnderecoForm({ inicial, salvando, onSalvar, onCancelar }: EnderecoFormProps) {
  const [form, setForm] = useState<FormEndereco>(inicial)
  const [erro, setErro] = useState<string | null>(null)

  function set(campo: keyof FormEndereco, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (erro) setErro(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.endereco.trim()) {
      setErro('Informe o endereço')
      return
    }
    onSalvar(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl px-4 py-4 shadow-sm space-y-4">
      <Input
        id="apelido"
        label="Apelido (opcional)"
        placeholder="Casa, Trabalho..."
        value={form.apelido}
        onChange={e => set('apelido', e.target.value)}
      />
      <div>
        <Input
          id="endereco"
          label="Endereço"
          placeholder="Rua, número, bairro"
          value={form.endereco}
          onChange={e => set('endereco', e.target.value)}
          autoComplete="street-address"
        />
        {erro && <p className="text-xs text-danger mt-1">{erro}</p>}
      </div>
      <Input
        id="complemento"
        label="Complemento (opcional)"
        placeholder="Apto, bloco, casa..."
        value={form.complemento}
        onChange={e => set('complemento', e.target.value)}
      />
      <Input
        id="referencia"
        label="Ponto de referência (opcional)"
        placeholder="Próximo a..."
        value={form.referencia}
        onChange={e => set('referencia', e.target.value)}
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={salvando} className="flex-1">
          {salvando ? 'Salvando...' : 'Salvar endereço'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function ContaCliente() {
  const router = useRouter()

  const [cliente, setCliente]   = useState<Cliente | null | undefined>(undefined)
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [editando, setEditando] = useState<string | 'novo' | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [expandidoPedido, setExpandidoPedido] = useState<string | null>(null)
  const [itensPorPedido, setItensPorPedido] = useState<Record<string, ItemPedido[]>>({})
  const [loadingItens, setLoadingItens] = useState<Record<string, boolean>>({})

  const carregarEnderecos = useCallback(async (clienteId: string) => {
    const { data } = await supabase
      .from('enderecos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('padrao', { ascending: false })
      .order('criado_em', { ascending: true })
    setEnderecos((data as Endereco[]) ?? [])
  }, [])

  const carregarPedidos = useCallback(async (clienteId: string) => {
    const { data } = await supabase
      .from('pedidos')
      .select('id,status,total,criado_em,forma_pagamento,endereco_entrega,lojas(nome,slug)')
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: false })

    const norm: Pedido[] = (data ?? []).map((p) => {
      const loja = (p as { lojas?: { nome?: string; slug?: string } | null }).lojas
      return {
        id: p.id as string,
        status: p.status as OrderStatus,
        total: p.total as number,
        criado_em: p.criado_em as string,
        forma_pagamento: p.forma_pagamento as string,
        endereco_entrega: p.endereco_entrega as string,
        loja_nome: loja?.nome ?? 'Loja',
        loja_slug: loja?.slug ?? '',
      }
    })
    setPedidos(norm)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/entrar?redirect=/conta')
        return
      }
      setCliente({
        id: user.id,
        nome: (user.user_metadata?.nome as string) ?? '',
        email: user.email ?? '',
      })
      await Promise.all([carregarEnderecos(user.id), carregarPedidos(user.id)])
    }
    init()
  }, [router, carregarEnderecos, carregarPedidos])

  async function handleTogglePedido(id: string) {
    const abrindo = expandidoPedido !== id
    setExpandidoPedido(abrindo ? id : null)

    if (abrindo && !itensPorPedido[id]) {
      setLoadingItens(prev => ({ ...prev, [id]: true }))
      const { data } = await supabase
        .from('itens_pedido')
        .select('*')
        .eq('pedido_id', id)
      setItensPorPedido(prev => ({ ...prev, [id]: (data as ItemPedido[]) ?? [] }))
      setLoadingItens(prev => ({ ...prev, [id]: false }))
    }
  }

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/entrar')
  }

  async function handleSalvar(valores: FormEndereco) {
    if (!cliente) return
    setSalvando(true)

    const payload = {
      apelido: valores.apelido.trim() || null,
      endereco: valores.endereco.trim(),
      complemento: valores.complemento.trim() || null,
      referencia: valores.referencia.trim() || null,
    }

    if (editando === 'novo') {
      // Primeiro endereço vira padrão automaticamente
      await supabase.from('enderecos').insert({
        ...payload,
        cliente_id: cliente.id,
        padrao: enderecos.length === 0,
      })
    } else if (editando) {
      await supabase.from('enderecos').update(payload).eq('id', editando)
    }

    await carregarEnderecos(cliente.id)
    setEditando(null)
    setSalvando(false)
  }

  async function handleExcluir(id: string) {
    if (!cliente) return
    await supabase.from('enderecos').delete().eq('id', id)
    await carregarEnderecos(cliente.id)
  }

  async function handleMarcarPadrao(id: string) {
    if (!cliente) return
    // Desmarca todos e marca apenas o escolhido
    await supabase.from('enderecos').update({ padrao: false }).eq('cliente_id', cliente.id)
    await supabase.from('enderecos').update({ padrao: true }).eq('id', id)
    await carregarEnderecos(cliente.id)
  }

  if (cliente === undefined) return null
  if (cliente === null) return null

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* Header */}
      <TopBar
        width="narrow"
        left={
          <IconButton onClick={() => router.back()} aria-label="Voltar">
            <ArrowLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
        title="Minha conta"
        right={
          <button
            onClick={handleSair}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:text-danger/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-2 py-1"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sair
          </button>
        }
      />

      <main>
       <PageContainer size="narrow" className="py-6 flex flex-col gap-6">

        {/* Dados do cliente */}
        <div className="bg-surface rounded-xl px-4 py-4 shadow-sm">
          {cliente.nome && (
            <p className="text-base font-semibold text-ink">{cliente.nome}</p>
          )}
          <p className="text-sm text-ink-soft mt-0.5">{cliente.email}</p>
        </div>

        {/* Endereços */}
        <section className="flex flex-col gap-3">
          <SectionTitle
            action={editando === null && (
              <Button
                variant="secondary"
                className="!min-h-[40px] text-xs px-3"
                onClick={() => setEditando('novo')}
              >
                <Plus size={15} strokeWidth={2} />
                Adicionar
              </Button>
            )}
          >
            Meus endereços
          </SectionTitle>

          {/* Formulário novo endereço */}
          {editando === 'novo' && (
            <EnderecoForm
              inicial={FORM_VAZIO}
              salvando={salvando}
              onSalvar={handleSalvar}
              onCancelar={() => setEditando(null)}
            />
          )}

          {/* Lista de endereços */}
          {enderecos.length === 0 && editando !== 'novo' ? (
            <div className="rounded-xl border border-dashed border-line py-10 text-center">
              <MapPin size={28} strokeWidth={1.25} className="text-ink-mute mx-auto mb-2" />
              <p className="text-sm text-ink-soft">Nenhum endereço salvo ainda.</p>
              <p className="text-xs text-ink-mute mt-1">
                Adicione um para agilizar seus próximos pedidos.
              </p>
            </div>
          ) : (
            enderecos.map(end => (
              editando === end.id ? (
                <EnderecoForm
                  key={end.id}
                  inicial={{
                    apelido: end.apelido ?? '',
                    endereco: end.endereco,
                    complemento: end.complemento ?? '',
                    referencia: end.referencia ?? '',
                  }}
                  salvando={salvando}
                  onSalvar={handleSalvar}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <div key={end.id} className="bg-surface rounded-xl px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {end.apelido && (
                          <span className="text-sm font-semibold text-ink">{end.apelido}</span>
                        )}
                        {end.padrao && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-2 py-0.5">
                            <Star size={11} strokeWidth={2} className="fill-brand-700" />
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-soft mt-1 leading-snug">{end.endereco}</p>
                      {end.complemento && (
                        <p className="text-xs text-ink-mute mt-0.5">{end.complemento}</p>
                      )}
                      {end.referencia && (
                        <p className="text-xs text-ink-mute mt-0.5">Ref: {end.referencia}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-line">
                    {!end.padrao && (
                      <button
                        onClick={() => handleMarcarPadrao(end.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Star size={13} strokeWidth={1.75} />
                        Tornar padrão
                      </button>
                    )}
                    <button
                      onClick={() => setEditando(end.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:bg-brand-50 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ml-auto"
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(end.id)}
                      aria-label="Excluir endereço"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:bg-danger/10 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                      Excluir
                    </button>
                  </div>
                </div>
              )
            ))
          )}
        </section>

        {/* Meus pedidos */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Meus pedidos</SectionTitle>

          {pedidos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-10 text-center">
              <ShoppingBag size={28} strokeWidth={1.25} className="text-ink-mute mx-auto mb-2" />
              <p className="text-sm text-ink-soft">Você ainda não fez pedidos.</p>
              <Link
                href="/"
                className="inline-block mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
              >
                Explorar a loja
              </Link>
            </div>
          ) : (
            pedidos.map(p => (
              <PedidoCard
                key={p.id}
                pedido={p}
                itens={itensPorPedido[p.id]}
                loadingItens={!!loadingItens[p.id]}
                expandido={expandidoPedido === p.id}
                onToggle={() => handleTogglePedido(p.id)}
              />
            ))
          )}
        </section>
       </PageContainer>
      </main>
    </div>
  )
}
