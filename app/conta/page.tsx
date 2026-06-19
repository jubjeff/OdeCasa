'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, MapPin, Plus, Pencil, Trash2, LogOut,
  ChevronDown, ChevronUp, ShoppingBag, Repeat, Check, XCircle,
  MoreHorizontal, Key, Lock, Phone, Building2, Truck, Wallet,
  MessageCircle, X, Star, ExternalLink, LayoutDashboard, ChevronRight,
  Users, UserPlus, Copy, AlertCircle, CheckCircle,
  Webhook, Eye, EyeOff, FlaskConical, Trash,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge, type OrderStatus } from '@/components/ui/StatusBadge'
import { TopBar } from '@/components/ui/TopBar'
import { PageContainer } from '@/components/ui/PageContainer'
import { IconButton } from '@/components/ui/IconButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PlanGate } from '@/components/PlanGate'
import { PlanProvider } from '@/hooks/usePlan'

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
  cep: string | null
  padrao: boolean
  criado_em: string
}

interface FormEndereco {
  apelido: string
  cep: string
  endereco: string
  complemento: string
  referencia: string
}

const FORM_ENDERECO_VAZIO: FormEndereco = { apelido: '', cep: '', endereco: '', complemento: '', referencia: '' }

interface Pedido {
  id: string
  loja_id: string
  status: OrderStatus
  total: number
  criado_em: string
  forma_pagamento: string
  endereco_entrega: string
  loja_nome: string
  loja_slug: string
  loja_avaliacoes_ativas: boolean
}

interface ItemPedido {
  pedido_id: string
  nome_produto: string
  preco_unitario: number
  unidade: string
  quantidade: number
  subtotal: number
}

interface LojaOwner {
  id: string
  nome: string
  slug: string
  endereco: string | null
  whatsapp: string | null
  taxa_entrega: number
  pedido_minimo: number | null
  chave_pix: string | null
  avaliacoes_ativas: boolean
}

/* ── Helpers ─────────────────────────────────────── */

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
function labelUnidade(un: string): string { return LABEL_UNIDADE[un] ?? un }
const LABEL_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao_entrega: 'Cartão na entrega',
}

function iconeEndereco(apelido: string | null): string {
  const a = (apelido ?? '').toLowerCase()
  if (a.includes('casa') || a.includes('home')) return '🏠'
  if (a.includes('trabalho') || a.includes('emprego') || a.includes('escritório') || a.includes('escritorio')) return '🏢'
  return '📍'
}

/* ── StatusStepper (timeline de acompanhamento) ── */

const FLUXO: { key: OrderStatus; label: string }[] = [
  { key: 'recebido',     label: 'Recebido' },
  { key: 'preparando',   label: 'Preparando' },
  { key: 'saiu_entrega', label: 'Saiu p/ entrega' },
  { key: 'entregue',     label: 'Entregue' },
]

const ETAPA_BG: Record<string, string> = {
  recebido: 'bg-ink-soft', preparando: 'bg-accent',
  saiu_entrega: 'bg-brand-300', entregue: 'bg-brand-500',
}
const ETAPA_PULSE: Record<string, string> = {
  recebido: 'animate-pulse', preparando: 'animate-pulse-ring-accent',
  saiu_entrega: 'animate-pulse-ring', entregue: '',
}

function StatusStepper({ status }: { status: OrderStatus }) {
  if (status === 'cancelado') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2.5">
        <XCircle size={16} strokeWidth={2} className="text-danger shrink-0" />
        <span className="text-sm font-medium text-danger">Pedido cancelado</span>
      </div>
    )
  }
  const atual = FLUXO.findIndex(s => s.key === status)
  return (
    <div className="flex">
      {FLUXO.map((step, i) => {
        const concluido = i < atual
        const ativo = i === atual
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <span aria-hidden="true" className={['absolute top-[11px] left-[-50%] right-1/2 h-0.5', i <= atual ? 'bg-brand-300' : 'bg-line'].join(' ')} />
            )}
            <span className={[
              'relative z-10 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-200',
              concluido ? 'bg-brand-500 text-surface'
                : ativo ? `${ETAPA_BG[step.key]} text-surface ${ETAPA_PULSE[step.key]}`
                  : 'bg-surface border border-line',
            ].join(' ')}>
              {concluido
                ? <Check size={13} strokeWidth={3} />
                : ativo
                  ? <span className="w-2 h-2 rounded-full bg-surface" />
                  : <span className="w-1.5 h-1.5 rounded-full bg-line" />}
            </span>
            <span className={['mt-2 text-[11px] leading-tight text-center px-0.5', ativo ? 'font-semibold text-ink' : concluido ? 'text-ink-soft' : 'text-ink-mute'].join(' ')}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Card de pedido ───────────────────────────────── */

interface PedidoCardProps {
  pedido: Pedido
  itens: ItemPedido[] | undefined
  loadingItens: boolean
  expandido: boolean
  avaliado: boolean
  onToggle: () => void
  onAvaliar: () => void
}

function PedidoCard({ pedido, itens, loadingItens, expandido, avaliado, onToggle, onAvaliar }: PedidoCardProps) {
  const resumoItens = itens && itens.length > 0
    ? itens.slice(0, 3).map(i => `${formatarQtd(i.quantidade, i.unidade)}× ${i.nome_produto}`).join(' · ')
    : null

  return (
    <div className="bg-surface rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150">
      <button
        onClick={onToggle}
        aria-expanded={expandido}
        className="w-full text-left px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink truncate">{pedido.loja_nome}</p>
          <StatusBadge status={pedido.status} />
        </div>

        {resumoItens && (
          <p className="text-xs text-ink-mute mt-1 truncate">{resumoItens}</p>
        )}

        <div className="flex items-center justify-between gap-2 mt-2">
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
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-3">Acompanhamento</p>
            <StatusStepper status={pedido.status} />
          </div>

          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">Itens</p>
            {loadingItens ? (
              <p className="text-xs text-ink-mute">Carregando…</p>
            ) : itens && itens.length > 0 ? (
              <div className="space-y-1.5">
                {itens.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline gap-2">
                    <span className="text-sm text-ink flex-1 min-w-0 truncate">
                      {item.nome_produto}
                      <span className="text-ink-mute ml-1">
                        × {formatarQtd(item.quantidade, item.unidade)} {labelUnidade(item.unidade)}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-ink shrink-0">{formatarReal(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-mute">Sem itens registrados</p>
            )}
          </div>

          <div className="space-y-2 border-t border-line pt-3">
            <div className="flex items-start gap-2">
              <MapPin size={13} strokeWidth={1.75} className="text-ink-mute shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-soft leading-snug">{pedido.endereco_entrega}</p>
                {pedido.endereco_entrega && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.endereco_entrega)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-brand-700 hover:text-brand-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  >
                    <ExternalLink size={11} strokeWidth={1.75} />
                    Ver no mapa
                  </a>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Pagamento</span>
              <span className="text-ink font-medium">{LABEL_PAGAMENTO[pedido.forma_pagamento] ?? pedido.forma_pagamento}</span>
            </div>
          </div>

          {pedido.loja_slug && (
            <Link
              href={`/loja/${pedido.loja_slug}?repetir=${pedido.id}`}
              className="flex items-center justify-center gap-2 w-full min-h-[40px] rounded-md text-xs font-semibold px-3 bg-surface border border-line text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Repeat size={14} strokeWidth={1.75} />
              Pedir de novo
            </Link>
          )}

          {pedido.status === 'entregue' && pedido.loja_avaliacoes_ativas && (
            avaliado ? (
              <div className="flex items-center justify-center gap-2 w-full min-h-[40px] rounded-md text-xs font-medium px-3 bg-surface border border-line text-ink-mute select-none">
                <Check size={13} strokeWidth={2.5} />
                Avaliado
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onAvaliar() }}
                className="flex items-center justify-center gap-2 w-full min-h-[40px] rounded-md text-xs font-semibold px-3 text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Star size={13} strokeWidth={1.75} />
                Avaliar
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

/* ── Formulário de endereço ───────────────────────── */

interface EnderecoFormProps {
  inicial: FormEndereco
  salvando: boolean
  onSalvar: (v: FormEndereco) => void
  onCancelar: () => void
}

function EnderecoForm({ inicial, salvando, onSalvar, onCancelar }: EnderecoFormProps) {
  const [form, setForm] = useState<FormEndereco>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  function set(campo: keyof FormEndereco, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (erro) setErro(null)
  }

  async function handleCepChange(valor: string) {
    const digits = valor.replace(/\D/g, '').slice(0, 8)
    const formatado = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    set('cep', formatado)
    if (digits.length === 8) {
      setBuscandoCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
        const data = await res.json()
        if (!data.erro) {
          const partes = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean)
          setForm(f => ({ ...f, cep: formatado, endereco: partes.join(', ') }))
        }
      } catch { /* silent */ }
      setBuscandoCep(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.endereco.trim()) { setErro('Informe o endereço'); return }
    onSalvar(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl px-4 py-4 shadow-sm space-y-4">
      <Input id="apelido" label="Apelido (opcional)" placeholder="Casa, Trabalho..." value={form.apelido} onChange={e => set('apelido', e.target.value)} />
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
          <p className="text-xs text-ink-mute mt-1 animate-pulse">Buscando CEP…</p>
        )}
      </div>
      <div>
        <Input id="endereco" label="Endereço" placeholder="Rua, número, bairro" value={form.endereco} onChange={e => set('endereco', e.target.value)} autoComplete="street-address" />
        {erro && <p className="text-xs text-danger mt-1">{erro}</p>}
      </div>
      <Input id="complemento" label="Complemento (opcional)" placeholder="Apto, bloco, casa..." value={form.complemento} onChange={e => set('complemento', e.target.value)} />
      <Input id="referencia" label="Ponto de referência (opcional)" placeholder="Próximo a..." value={form.referencia} onChange={e => set('referencia', e.target.value)} />
      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={salvando} className="flex-1">{salvando ? 'Salvando...' : 'Salvar endereço'}</Button>
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={salvando}>Cancelar</Button>
      </div>
    </form>
  )
}

/* ── Seção de endereços ───────────────────────────── */

interface SecaoEnderecosProps {
  enderecos: Endereco[]
  editando: string | 'novo' | null
  salvando: boolean
  excluirId: string | null
  onEditar: (id: string | 'novo') => void
  onCancelar: () => void
  onSalvar: (v: FormEndereco) => void
  onExcluirPedir: (id: string) => void
  onExcluirConfirmar: () => void
  onExcluirCancelar: () => void
  onMarcarPadrao: (id: string) => void
}

function SecaoEnderecos({
  enderecos, editando, salvando, excluirId,
  onEditar, onCancelar, onSalvar, onExcluirPedir, onExcluirConfirmar, onExcluirCancelar, onMarcarPadrao,
}: SecaoEnderecosProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-ink">Endereços</p>
        {editando === null && (
          <button
            onClick={() => onEditar('novo')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-line bg-surface text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus size={15} strokeWidth={2} />
            Adicionar
          </button>
        )}
      </div>

      {editando === 'novo' && (
        <EnderecoForm inicial={FORM_ENDERECO_VAZIO} salvando={salvando} onSalvar={onSalvar} onCancelar={onCancelar} />
      )}

      {enderecos.length === 0 && editando !== 'novo' ? (
        <div className="rounded-xl border border-dashed border-line py-12 text-center flex flex-col items-center gap-3">
          <MapPin size={32} strokeWidth={1.25} className="text-ink-mute" />
          <div>
            <p className="text-sm font-semibold text-ink">Nenhum endereço salvo</p>
            <p className="text-xs text-ink-mute mt-0.5">Adicione um para agilizar seus pedidos.</p>
          </div>
          <button
            onClick={() => onEditar('novo')}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand-50 text-brand-700 text-sm font-medium hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus size={15} strokeWidth={2} />
            Adicionar endereço
          </button>
        </div>
      ) : (
        enderecos.map(end =>
          editando === end.id ? (
            <EnderecoForm
              key={end.id}
              inicial={{ apelido: end.apelido ?? '', cep: end.cep ?? '', endereco: end.endereco, complemento: end.complemento ?? '', referencia: end.referencia ?? '' }}
              salvando={salvando}
              onSalvar={onSalvar}
              onCancelar={onCancelar}
            />
          ) : (
            <div key={end.id} className="group bg-surface rounded-xl px-4 py-4 shadow-sm hover:shadow-md transition-shadow duration-150">
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5 select-none" aria-hidden="true">
                  {iconeEndereco(end.apelido)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {end.apelido && (
                      <span className="text-sm font-semibold text-ink">{end.apelido}</span>
                    )}
                    {end.padrao && (
                      <span className="inline-flex items-center text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-2 py-0.5">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft mt-1 leading-snug">{end.endereco}</p>
                  {end.cep && <p className="text-xs text-ink-mute mt-0.5">CEP {end.cep}</p>}
                  {end.complemento && <p className="text-xs text-ink-mute mt-0.5">{end.complemento}</p>}
                  {end.referencia && <p className="text-xs text-ink-mute mt-0.5">Ref: {end.referencia}</p>}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                  <button
                    onClick={() => onEditar(end.id)}
                    title="Editar endereço"
                    aria-label="Editar endereço"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 hover:text-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:opacity-100"
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => onExcluirPedir(end.id)}
                    title="Excluir endereço"
                    aria-label="Excluir endereço"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-ink-mute hover:bg-danger/10 hover:text-danger transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:opacity-100"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {!end.padrao && (
                <button
                  onClick={() => onMarcarPadrao(end.id)}
                  className="mt-3 text-xs font-medium text-brand-700 hover:text-brand-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-0.5"
                >
                  Tornar padrão
                </button>
              )}
            </div>
          )
        )
      )}

      {excluirId && (
        <ConfirmDialog
          mensagem="Deseja excluir este endereço? Esta ação não pode ser desfeita."
          labelConfirmar="Excluir"
          onConfirmar={onExcluirConfirmar}
          onCancelar={onExcluirCancelar}
        />
      )}
    </div>
  )
}

/* ── Modal de avaliação ───────────────────────────── */

function ModalAvaliacao({
  pedidoId, lojaId, clienteId, nomeLoja, onFechar, onEnviado,
}: {
  pedidoId: string
  lojaId: string
  clienteId: string
  nomeLoja: string
  onFechar: () => void
  onEnviado: (pedidoId: string) => void
}) {
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleEnviar() {
    if (nota === 0) { setErro('Selecione uma nota'); return }
    setEnviando(true)
    const { error } = await supabase.from('avaliacoes').insert({
      pedido_id: pedidoId,
      loja_id: lojaId,
      cliente_id: clienteId,
      nota,
      comentario: comentario.trim() || null,
    })
    setEnviando(false)
    if (error) { setErro('Não foi possível enviar. Tente novamente.'); return }
    onEnviado(pedidoId)
  }

  const estrelaAtiva = hover || nota
  const LABELS = ['', 'Ruim', 'Regular', 'Bom', 'Ótimo', 'Excelente']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-avaliar-titulo"
      onClick={onFechar}
    >
      <div
        className="animate-modal-in bg-surface rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="modal-avaliar-titulo" className="text-base font-semibold text-ink">
            Avaliar pedido
          </h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <p className="text-sm text-ink-soft">
          Como foi seu pedido em{' '}
          <span className="font-medium text-ink">{nomeLoja}</span>?
        </p>

        <div className="flex items-center justify-center gap-1.5 py-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => { setNota(n); setErro(null) }}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
              className="transition-transform duration-100 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded p-0.5"
            >
              <Star
                size={36}
                strokeWidth={1.5}
                className={n <= estrelaAtiva ? 'text-accent fill-accent' : 'text-line fill-transparent'}
              />
            </button>
          ))}
        </div>

        {estrelaAtiva > 0 && (
          <p className="text-center text-xs font-medium text-ink-soft -mt-2">
            {LABELS[estrelaAtiva]}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="avaliacao-comentario" className="text-sm font-medium text-ink-soft">
            Comentário{' '}
            <span className="text-ink-mute font-normal">(opcional)</span>
          </label>
          <textarea
            id="avaliacao-comentario"
            rows={3}
            placeholder="Conte como foi..."
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            className={[
              'w-full rounded-md border border-line bg-surface px-3 py-2.5',
              'text-sm text-ink placeholder:text-ink-mute resize-none',
              'outline-none transition-shadow focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            ].join(' ')}
          />
        </div>

        {erro && <p className="text-xs text-danger">{erro}</p>}

        <Button
          variant="primary"
          className="w-full"
          onClick={handleEnviar}
          disabled={enviando || nota === 0}
        >
          {enviando ? 'Enviando…' : 'Enviar avaliação'}
        </Button>
      </div>
    </div>
  )
}

/* ── Seção da loja (donos) ────────────────────────── */

interface SecaoLojaProps {
  loja: LojaOwner
  onAtualizar: (l: LojaOwner) => void
}

function SecaoLoja({ loja, onAtualizar }: SecaoLojaProps) {
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    nome: loja.nome,
    endereco: loja.endereco ?? '',
    whatsapp: loja.whatsapp ?? '',
    taxa_entrega: String(loja.taxa_entrega),
    pedido_minimo: loja.pedido_minimo != null ? String(loja.pedido_minimo) : '',
    chave_pix: loja.chave_pix ?? '',
    avaliacoes_ativas: loja.avaliacoes_ativas,
  })

  async function salvar() {
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      endereco: form.endereco.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      taxa_entrega: parseFloat(form.taxa_entrega.replace(',', '.')) || 0,
      pedido_minimo: form.pedido_minimo.trim() ? parseFloat(form.pedido_minimo.replace(',', '.')) : null,
      chave_pix: form.chave_pix.trim() || null,
      avaliacoes_ativas: form.avaliacoes_ativas,
    }
    await supabase.from('lojas').update(payload).eq('id', loja.id)
    onAtualizar({ ...loja, ...payload })
    setEditando(false)
    setSalvando(false)
  }

  function campo(label: string, icon: React.ReactNode, value: string, field: Exclude<keyof typeof form, 'avaliacoes_ativas'>, placeholder?: string) {
    return (
      <div className="flex items-start gap-3 py-3 border-b border-line last:border-0">
        <div className="text-brand-500 shrink-0 mt-1">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink-mute mb-1">{label}</p>
          {editando ? (
            <input
              value={form[field]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              placeholder={placeholder}
              className="w-full h-9 px-3 rounded-md border border-line bg-bg text-sm text-ink placeholder:text-ink-mute outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
            />
          ) : (
            <p className="text-sm text-ink">{value || <span className="text-ink-mute italic">Não informado</span>}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Dados da loja */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <p className="text-sm font-semibold text-ink">Dados da loja</p>
          {editando ? (
            <div className="flex gap-2">
              <button onClick={() => setEditando(false)} className="text-xs font-medium text-ink-soft hover:text-ink px-2 py-1 rounded transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="text-xs font-semibold text-brand-700 hover:text-brand-900 px-2 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditando(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900 px-2 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Pencil size={13} strokeWidth={1.75} />Editar
            </button>
          )}
        </div>
        <div className="px-4">
          {campo('Nome', <Building2 size={15} strokeWidth={1.75} />, loja.nome, 'nome', 'Nome da loja')}
          {campo('Endereço', <MapPin size={15} strokeWidth={1.75} />, loja.endereco ?? '', 'endereco', 'Rua, número, bairro')}
          {campo('WhatsApp', <Phone size={15} strokeWidth={1.75} />, loja.whatsapp ?? '', 'whatsapp', '(11) 9 0000-0000')}
        </div>
      </div>

      {/* Entrega */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <p className="text-sm font-semibold text-ink">Configurações de entrega</p>
        </div>
        <div className="px-4">
          {campo('Taxa de entrega (R$)', <Truck size={15} strokeWidth={1.75} />, loja.taxa_entrega === 0 ? 'Grátis' : `R$ ${loja.taxa_entrega}`, 'taxa_entrega', '0')}
          {campo('Pedido mínimo (R$)', <Wallet size={15} strokeWidth={1.75} />, loja.pedido_minimo != null ? `R$ ${loja.pedido_minimo}` : '', 'pedido_minimo', 'Sem mínimo')}
        </div>
      </div>

      {/* Pagamento */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <p className="text-sm font-semibold text-ink">Formas de pagamento</p>
        </div>
        <div className="px-4 py-3 space-y-3">
          {(['Dinheiro', 'Cartão na entrega'] as const).map(label => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-sm text-ink">{label}</span>
              <span className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-100 rounded-full px-2.5 py-0.5 font-medium">
                <Check size={11} strokeWidth={2.5} /> Ativo
              </span>
            </div>
          ))}
          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-ink">Pix</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-2.5 py-0.5">
                <Check size={11} strokeWidth={2.5} /> Ativo
              </span>
            </div>
            <div>
              <p className="text-xs text-ink-mute mb-1">Chave Pix</p>
              {editando ? (
                <input
                  value={form.chave_pix}
                  onChange={e => setForm(f => ({ ...f, chave_pix: e.target.value }))}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  className="w-full h-9 px-3 rounded-md border border-line bg-bg text-sm text-ink placeholder:text-ink-mute outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                />
              ) : (
                <p className="text-sm text-ink font-mono">{loja.chave_pix || <span className="text-ink-mute italic not-italic font-sans">Não configurada</span>}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Avaliações */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <p className="text-sm font-semibold text-ink">Avaliações de clientes</p>
        </div>
        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink">Exibir avaliações publicamente</p>
            <p className="text-xs text-ink-mute mt-0.5 leading-relaxed">
              Quando ativo, clientes podem avaliar pedidos e a nota aparece no cardápio.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.avaliacoes_ativas}
            onClick={() => editando && setForm(f => ({ ...f, avaliacoes_ativas: !f.avaliacoes_ativas }))}
            className={[
              'relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              form.avaliacoes_ativas ? 'bg-brand-500' : 'bg-line',
              !editando ? 'cursor-default opacity-60' : 'cursor-pointer',
            ].join(' ')}
          >
            <span className={[
              'absolute top-0.5 left-0.5 w-5 h-5 bg-surface rounded-full shadow-sm transition-transform duration-200',
              form.avaliacoes_ativas ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Operadores ──────────────────────────────────── */

interface Operador {
  id: string
  email: string
  papel: 'gerente' | 'atendente' | 'caixa'
  status: 'pendente' | 'ativo' | 'inativo'
  invite_expires_at: string | null
  user_id: string | null
  criado_em: string
}

const PAPEL_LABEL: Record<string, string> = {
  gerente: 'Gerente',
  atendente: 'Atendente',
  caixa: 'Operador de caixa',
}

function SecaoOperadores({ lojaId, donoId }: { lojaId: string; donoId: string }) {
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [carregando, setCarregando] = useState(true)
  const [sheetAberto, setSheetAberto] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formPapel, setFormPapel] = useState<'gerente' | 'atendente' | 'caixa'>('atendente')
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erroConvite, setErroConvite] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [modoReenvio, setModoReenvio] = useState(false)

  async function carregarOperadores() {
    const { data } = await supabase
      .from('operadores')
      .select('id, email, papel, status, invite_expires_at, user_id, criado_em')
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: false })
    setOperadores((data as Operador[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregarOperadores() }, [lojaId])

  function resetForm() {
    setFormEmail('')
    setFormPapel('atendente')
    setLinkGerado(null)
    setErroConvite(null)
    setCopiado(false)
    setModoReenvio(false)
  }

  function fecharSheet() { setSheetAberto(false); resetForm() }

  async function gerarConvite() {
    const email = formEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { setErroConvite('Informe um e-mail válido'); return }
    setGerando(true)
    setErroConvite(null)

    const { data: existente } = await supabase
      .from('operadores')
      .select('id, status')
      .eq('loja_id', lojaId)
      .eq('email', email)
      .maybeSingle()

    if (existente) {
      if ((existente as { status: string }).status === 'ativo') {
        setErroConvite('Este e-mail já é operador desta loja.')
        setGerando(false)
        return
      }
      setModoReenvio(true)
      setGerando(false)
      return
    }

    const token = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('operadores').insert({
      loja_id: lojaId,
      email,
      papel: formPapel,
      status: 'pendente',
      convidado_por: donoId,
      invite_token: token,
      invite_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    if (error) { setErroConvite('Erro ao gerar convite. Tente novamente.'); setGerando(false); return }
    setLinkGerado(`${window.location.origin}/convite/${token}`)
    await carregarOperadores()
    setGerando(false)
  }

  async function reenviarConvite() {
    const email = formEmail.trim().toLowerCase()
    setGerando(true)
    const token = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase
      .from('operadores')
      .update({ invite_token: token, invite_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), papel: formPapel })
      .eq('loja_id', lojaId)
      .eq('email', email)
    if (error) { setErroConvite('Erro ao reenviar. Tente novamente.'); setGerando(false); return }
    setLinkGerado(`${window.location.origin}/convite/${token}`)
    setModoReenvio(false)
    await carregarOperadores()
    setGerando(false)
  }

  function copiarLink() {
    if (!linkGerado) return
    navigator.clipboard.writeText(linkGerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-ink">Operadores</p>
          <button
            onClick={() => setSheetAberto(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-line bg-surface text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <UserPlus size={15} strokeWidth={2} />
            Convidar
          </button>
        </div>

        {carregando ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-line p-4 animate-pulse flex gap-3">
                <div className="w-9 h-9 rounded-full bg-line shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-line" />
                  <div className="h-3 w-24 rounded bg-line" />
                </div>
              </div>
            ))}
          </div>
        ) : operadores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-12 text-center flex flex-col items-center gap-3">
            <Users size={32} strokeWidth={1.25} className="text-ink-mute" />
            <div>
              <p className="text-sm font-semibold text-ink">Nenhum operador</p>
              <p className="text-xs text-ink-mute mt-0.5">Convide sua equipe para ajudar a gerenciar a loja.</p>
            </div>
            <button
              onClick={() => setSheetAberto(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand-50 text-brand-700 text-sm font-medium hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <UserPlus size={15} strokeWidth={2} />
              Convidar operador
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {operadores.map(op => (
              <div key={op.id} className="bg-surface rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-brand-700">
                    {op.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{op.email}</p>
                  <p className="text-xs text-ink-mute">{PAPEL_LABEL[op.papel] ?? op.papel}</p>
                </div>
                <span className={[
                  'shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  op.status === 'ativo'
                    ? 'bg-brand-100 text-brand-700'
                    : op.status === 'pendente'
                      ? 'bg-line text-ink-soft'
                      : 'bg-danger/10 text-danger',
                ].join(' ')}>
                  {op.status === 'ativo' ? 'Ativo' : op.status === 'pendente' ? 'Pendente' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {sheetAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40"
          onClick={fecharSheet}
        >
          <div
            className="animate-modal-in bg-surface rounded-xl shadow-lg w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={18} strokeWidth={1.75} className="text-brand-500" />
                <h2 className="text-base font-semibold text-ink">Convidar operador</h2>
              </div>
              <button onClick={fecharSheet} aria-label="Fechar"
                className="w-8 h-8 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {modoReenvio ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 bg-accent/10 border border-accent/30 rounded-lg px-3 py-3">
                  <AlertCircle size={16} strokeWidth={1.75} className="text-accent shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-soft leading-snug">
                    Este e-mail já tem um convite pendente. Deseja gerar um novo link?
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setModoReenvio(false)}>Cancelar</Button>
                  <Button variant="primary" className="flex-1" onClick={reenviarConvite} disabled={gerando}>
                    {gerando ? 'Gerando…' : 'Reenviar convite'}
                  </Button>
                </div>
              </div>
            ) : linkGerado ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 bg-brand-50 border border-brand-200 rounded-lg px-3 py-3">
                  <CheckCircle size={16} strokeWidth={1.75} className="text-brand-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-brand-700 leading-snug font-medium">Convite gerado com sucesso!</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-mute">Link de convite</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={linkGerado}
                      className="flex-1 h-10 px-3 rounded-md border border-line bg-bg text-xs text-ink-soft font-mono outline-none truncate"
                    />
                    <button
                      onClick={copiarLink}
                      className="shrink-0 h-10 px-3 rounded-md border border-line bg-surface text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 flex items-center gap-1.5"
                    >
                      {copiado
                        ? <><Check size={13} strokeWidth={2.5} />Copiado</>
                        : <><Copy size={13} strokeWidth={1.75} />Copiar</>}
                    </button>
                  </div>
                  <p className="text-xs text-ink-mute">
                    Envie este link para {formEmail}. Expira em 48 horas.
                  </p>
                </div>
                <Button variant="secondary" className="w-full" onClick={fecharSheet}>Fechar</Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <Input
                    id="convite-email"
                    label="E-mail do operador"
                    type="email"
                    placeholder="nome@email.com"
                    value={formEmail}
                    onChange={e => { setFormEmail(e.target.value); setErroConvite(null) }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="convite-papel" className="text-sm font-medium text-ink-soft">Papel</label>
                    <select
                      id="convite-papel"
                      value={formPapel}
                      onChange={e => setFormPapel(e.target.value as 'gerente' | 'atendente' | 'caixa')}
                      className="h-12 px-3 rounded-md border border-line bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                    >
                      <option value="gerente">Gerente — painel completo</option>
                      <option value="atendente">Atendente — produtos e pedidos</option>
                      <option value="caixa">Operador de caixa — somente pedidos</option>
                    </select>
                  </div>
                  {erroConvite && <p className="text-xs text-danger">{erroConvite}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" className="flex-1" onClick={fecharSheet}>Cancelar</Button>
                  <Button variant="primary" className="flex-1" onClick={gerarConvite} disabled={gerando}>
                    {gerando ? 'Gerando…' : 'Gerar convite'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ── Seção API Key ───────────────────────────────── */

interface ApiKeyRow {
  id: string
  criado_em: string
  ultimo_uso: string | null
}

function SecaoApiKey({ lojaId }: { lojaId: string }) {
  const [apiKey, setApiKey] = useState<ApiKeyRow | null | undefined>(undefined)
  const [keyGerada, setKeyGerada] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [confirmarRevogar, setConfirmarRevogar] = useState(false)
  const [revogando, setRevogando] = useState(false)
  const [accordionAberto, setAccordionAberto] = useState(false)

  async function carregar() {
    const { data } = await supabase
      .from('api_keys')
      .select('id, criado_em, ultimo_uso')
      .eq('loja_id', lojaId)
      .maybeSingle()
    setApiKey(data as ApiKeyRow | null)
  }

  useEffect(() => { carregar() }, [lojaId])

  async function handleGerar() {
    setGerando(true)
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    const key = 'odecasa_sk_' + raw

    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key))
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const { error } = await supabase.from('api_keys').insert({ loja_id: lojaId, key_hash: hash })
    setGerando(false)
    if (error) return
    setKeyGerada(key)
    await carregar()
  }

  async function handleRevogar() {
    if (!apiKey) return
    setRevogando(true)
    await supabase.from('api_keys').delete().eq('id', apiKey.id)
    setApiKey(null)
    setKeyGerada(null)
    setConfirmarRevogar(false)
    setRevogando(false)
  }

  function handleCopiar() {
    if (!keyGerada) return
    navigator.clipboard.writeText(keyGerada)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const dominioBase = typeof window !== 'undefined' ? window.location.origin : 'https://seudominio.com'

  if (apiKey === undefined) {
    return (
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden animate-pulse">
        <div className="h-12 bg-line" />
        <div className="px-4 py-4 space-y-3">
          <div className="h-11 rounded-md bg-line" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Key size={16} strokeWidth={1.75} className="text-brand-500" />
          <p className="text-sm font-semibold text-ink flex-1">API Key</p>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          {apiKey === null && !keyGerada ? (
            /* ── Sem key ── */
            <div className="flex flex-col gap-3">
              <p className="text-xs text-ink-mute leading-relaxed">
                Acesse pedidos e produtos da sua loja via API REST. A chave dá acesso somente
                à sua loja e não pode ser recuperada após geração.
              </p>
              <Button variant="primary" onClick={handleGerar} disabled={gerando} className="self-start">
                {gerando ? 'Gerando…' : 'Gerar API Key'}
              </Button>
            </div>
          ) : keyGerada ? (
            /* ── Key recém-gerada (exibição única) ── */
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} strokeWidth={1.75} className="text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-ink-soft leading-snug font-medium">
                  Copie agora — esta chave não será exibida novamente.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-ink-mute">Sua API Key</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={keyGerada}
                    className="flex-1 h-11 px-3 rounded-md border border-line bg-bg text-xs text-ink font-mono outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopiar}
                    className="shrink-0 h-11 px-3 flex items-center gap-1.5 rounded-md border border-line bg-surface text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {copiado
                      ? <><Check size={13} strokeWidth={2.5} />Copiado</>
                      : <><Copy size={13} strokeWidth={1.75} />Copiar</>}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeyGerada(null)}
                className="self-start text-xs font-medium text-ink-mute hover:text-ink transition-colors"
              >
                Ok, guardei minha chave
              </button>
            </div>
          ) : (
            /* ── Key existente ── */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-ink-mute">Chave ativa</p>
                <input
                  readOnly
                  value="odecasa_sk_••••••••••••••••••••••••••••••••"
                  className="h-11 px-3 rounded-md border border-line bg-bg text-sm text-ink-soft font-mono outline-none"
                />
              </div>
              <div className="flex gap-4 text-xs text-ink-mute">
                <span>Criada em {formatarLogData(apiKey!.criado_em)}</span>
                {apiKey!.ultimo_uso && (
                  <span>Último uso {formatarLogData(apiKey!.ultimo_uso)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmarRevogar(true)}
                className="self-start inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-danger/30 bg-surface text-sm font-medium text-danger hover:bg-danger/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <Trash size={15} strokeWidth={1.75} />
                Revogar chave
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Accordion "Como usar a API" */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAccordionAberto(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-ink hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
          aria-expanded={accordionAberto}
        >
          Como usar a API
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={['text-ink-mute transition-transform duration-200', accordionAberto ? 'rotate-180' : ''].join(' ')}
          />
        </button>
        {accordionAberto && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t border-line pt-3">
            <p className="text-xs text-ink-mute leading-relaxed">
              Passe sua API Key no header <code className="font-mono bg-line px-1 rounded">Authorization: Bearer</code>.
            </p>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-ink-soft">Listar pedidos</p>
              <pre className="bg-bg rounded-lg p-3 text-xs font-mono text-ink-soft overflow-x-auto leading-relaxed whitespace-pre">{`curl -H "Authorization: Bearer odecasa_sk_SUA_CHAVE" \\
  "${dominioBase}/api/v1/pedidos?status=recebido"`}</pre>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-ink-soft">Listar produtos disponíveis</p>
              <pre className="bg-bg rounded-lg p-3 text-xs font-mono text-ink-soft overflow-x-auto leading-relaxed whitespace-pre">{`curl -H "Authorization: Bearer odecasa_sk_SUA_CHAVE" \\
  "${dominioBase}/api/v1/produtos?disponivel=true"`}</pre>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-ink-soft">Parâmetros disponíveis</p>
              <div className="bg-bg rounded-lg p-3 text-xs font-mono text-ink-soft leading-relaxed space-y-1">
                <p><span className="text-brand-700">GET</span> /api/v1/pedidos</p>
                <p className="pl-3 text-ink-mute">status, limit (máx 100), offset</p>
                <p className="mt-2"><span className="text-brand-700">GET</span> /api/v1/produtos</p>
                <p className="pl-3 text-ink-mute">disponivel, categoria_id, limit (máx 100), offset</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmarRevogar && (
        <ConfirmDialog
          mensagem="Revogar a API Key? Qualquer integração usando esta chave deixará de funcionar imediatamente."
          labelConfirmar="Revogar"
          onConfirmar={handleRevogar}
          onCancelar={() => setConfirmarRevogar(false)}
        />
      )}
    </>
  )
}

/* ── Seção Integrações / Webhook ─────────────────── */

interface WebhookConfig {
  id: string
  url: string
  secret: string
  ativo: boolean
}

interface WebhookLog {
  id: string
  evento: string
  url: string
  status_http: number | null
  sucesso: boolean
  criado_em: string
}

function formatarLogData(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function SecaoIntegracoes({ lojaId }: { lojaId: string }) {
  const [config, setConfig] = useState<WebhookConfig | null | undefined>(undefined)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [urlForm, setUrlForm] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroUrl, setErroUrl] = useState<string | null>(null)
  const [secretVisivel, setSecretVisivel] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [testando, setTestando] = useState(false)
  const [confirmarRemover, setConfirmarRemover] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [accordionAberto, setAccordionAberto] = useState(false)

  async function carregar() {
    const { data: cfg } = await supabase
      .from('webhook_configs')
      .select('id, url, secret, ativo')
      .eq('loja_id', lojaId)
      .maybeSingle()
    setConfig(cfg as WebhookConfig | null)

    const { data: lgData } = await supabase
      .from('webhook_logs')
      .select('id, evento, url, status_http, sucesso, criado_em')
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: false })
      .limit(10)
    setLogs((lgData as WebhookLog[]) ?? [])
  }

  useEffect(() => { carregar() }, [lojaId])

  async function handleAtivar() {
    const url = urlForm.trim()
    if (!url.startsWith('http')) { setErroUrl('Informe uma URL válida (https://...)'); return }
    setSalvando(true)
    const secret = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('webhook_configs').insert({
      loja_id: lojaId, url, secret, ativo: true,
    })
    setSalvando(false)
    if (error) { setErroUrl('Não foi possível salvar. Tente novamente.'); return }
    await carregar()
  }

  async function handleToggleAtivo() {
    if (!config) return
    const novoAtivo = !config.ativo
    await supabase.from('webhook_configs').update({ ativo: novoAtivo }).eq('id', config.id)
    setConfig(c => c ? { ...c, ativo: novoAtivo } : c)
  }

  async function handleTestar() {
    if (!config) return
    setTestando(true)
    await fetch('/api/webhook/disparar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loja_id: lojaId, evento: 'webhook.teste', pedido_id: null }),
    }).catch(() => {})
    await carregar()
    setTestando(false)
  }

  async function handleRemover() {
    if (!config) return
    setRemovendo(true)
    await supabase.from('webhook_configs').delete().eq('id', config.id)
    setConfig(null)
    setLogs([])
    setConfirmarRemover(false)
    setRemovendo(false)
  }

  function handleCopiarSecret() {
    if (!config) return
    navigator.clipboard.writeText(config.secret)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (config === undefined) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-12 rounded-xl bg-line" />
        <div className="h-12 rounded-xl bg-line" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Seção Webhook */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Webhook size={16} strokeWidth={1.75} className="text-brand-500" />
          <p className="text-sm font-semibold text-ink flex-1">Webhook</p>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          {config === null ? (
            /* ── Estado: não configurado ── */
            <div className="flex flex-col gap-3">
              <p className="text-xs text-ink-mute leading-relaxed">
                Receba notificações em tempo real quando pedidos forem criados ou atualizados.
              </p>
              <div className="flex flex-col gap-1">
                <Input
                  id="webhook-url"
                  label="URL do webhook"
                  placeholder="https://seusite.com/webhook"
                  value={urlForm}
                  onChange={e => { setUrlForm(e.target.value); setErroUrl(null) }}
                />
                {erroUrl && <p className="text-xs text-danger">{erroUrl}</p>}
              </div>
              <Button variant="primary" onClick={handleAtivar} disabled={salvando} className="self-start">
                {salvando ? 'Ativando…' : 'Ativar webhook'}
              </Button>
            </div>
          ) : (
            /* ── Estado: configurado ── */
            <div className="flex flex-col gap-4">

              {/* URL ativa */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-ink-mute">URL ativa</p>
                <input
                  readOnly
                  value={config.url}
                  className="h-11 px-3 rounded-md border border-line bg-bg text-sm text-ink-soft font-mono outline-none truncate"
                />
              </div>

              {/* Toggle ativo/inativo */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-ink">Status do webhook</p>
                  <p className="text-xs text-ink-mute mt-0.5">{config.ativo ? 'Disparando eventos' : 'Pausado — eventos não serão enviados'}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.ativo}
                  onClick={handleToggleAtivo}
                  className={[
                    'relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 cursor-pointer',
                    config.ativo ? 'bg-brand-500' : 'bg-line',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-surface rounded-full shadow-sm transition-transform duration-200',
                    config.ativo ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')} />
                </button>
              </div>

              {/* Secret */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-ink-mute">Secret (HMAC-SHA256)</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    type={secretVisivel ? 'text' : 'password'}
                    value={config.secret}
                    className="flex-1 h-11 px-3 rounded-md border border-line bg-bg text-sm text-ink font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSecretVisivel(v => !v)}
                    title={secretVisivel ? 'Ocultar' : 'Revelar'}
                    aria-label={secretVisivel ? 'Ocultar secret' : 'Revelar secret'}
                    className="shrink-0 h-11 w-11 flex items-center justify-center rounded-md border border-line bg-surface text-ink-soft hover:bg-brand-50 hover:text-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {secretVisivel ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopiarSecret}
                    title="Copiar secret"
                    aria-label="Copiar secret"
                    className="shrink-0 h-11 px-3 flex items-center gap-1.5 rounded-md border border-line bg-surface text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {copiado ? <><Check size={13} strokeWidth={2.5} />Copiado</> : <><Copy size={13} strokeWidth={1.75} />Copiar</>}
                  </button>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestar}
                  disabled={testando}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-line bg-surface text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <FlaskConical size={15} strokeWidth={1.75} />
                  {testando ? 'Testando…' : 'Testar webhook'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarRemover(true)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-danger/30 bg-surface text-sm font-medium text-danger hover:bg-danger/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                >
                  <Trash size={15} strokeWidth={1.75} />
                  Remover
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de logs */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <p className="text-sm font-semibold text-ink">Últimos disparos</p>
        </div>
        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-ink-mute">Nenhum disparo registrado ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3 text-xs">
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-line text-ink-soft font-medium truncate max-w-[140px]">
                  {log.evento}
                </span>
                <span className="shrink-0 font-mono text-ink-soft w-9 text-center">
                  {log.status_http ?? '—'}
                </span>
                <span className={[
                  'shrink-0 px-2 py-0.5 rounded-full font-medium',
                  log.sucesso ? 'bg-brand-100 text-brand-700' : 'bg-danger/10 text-danger',
                ].join(' ')}>
                  {log.sucesso ? 'sucesso' : 'falha'}
                </span>
                <span className="ml-auto shrink-0 text-ink-mute tabular-nums">
                  {formatarLogData(log.criado_em)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accordion verificar assinatura */}
      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAccordionAberto(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-ink hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
          aria-expanded={accordionAberto}
        >
          Como verificar a assinatura
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={['text-ink-mute transition-transform duration-200', accordionAberto ? 'rotate-180' : ''].join(' ')}
          />
        </button>
        {accordionAberto && (
          <div className="px-4 pb-4 flex flex-col gap-2 border-t border-line pt-3">
            <p className="text-xs text-ink-mute leading-relaxed">
              Cada requisição inclui o header <code className="font-mono bg-line px-1 rounded">X-OdeCasa-Signature</code> com um HMAC-SHA256 do body. Verifique assim:
            </p>
            <pre className="bg-bg rounded-lg p-3 text-xs font-mono text-ink-soft overflow-x-auto leading-relaxed whitespace-pre">{`const { createHmac } = require('crypto')

const assinatura = createHmac('sha256', SEU_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex')

if (assinatura !== req.headers['x-odecasa-signature']) {
  return res.status(401).send('Assinatura inválida')
}`}</pre>
          </div>
        )}
      </div>

      {/* Seção API Key */}
      <SecaoApiKey lojaId={lojaId} />

      {/* Modal confirmação remoção webhook */}
      {confirmarRemover && (
        <ConfirmDialog
          mensagem="Remover o webhook? Todos os disparos serão interrompidos. Esta ação não pode ser desfeita."
          labelConfirmar="Remover"
          onConfirmar={handleRemover}
          onCancelar={() => setConfirmarRemover(false)}
        />
      )}
    </div>
  )
}

/* ── Página ──────────────────────────────────────── */

type Aba = 'pedidos' | 'enderecos' | 'loja' | 'operadores' | 'integracoes'
type FiltroPedidos = 'todos' | 'andamento' | 'concluidos'

function ContaCliente() {
  const router = useRouter()

  const [cliente, setCliente]     = useState<Cliente | null | undefined>(undefined)
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [editando, setEditando]   = useState<string | 'novo' | null>(null)
  const [salvando, setSalvando]   = useState(false)
  const [excluirId, setExcluirId] = useState<string | null>(null)

  const [pedidos, setPedidos]     = useState<Pedido[]>([])
  const [expandidoPedido, setExpandidoPedido] = useState<string | null>(null)
  const [itensPorPedido, setItensPorPedido]   = useState<Record<string, ItemPedido[]>>({})
  const [loadingItens, setLoadingItens]       = useState<Record<string, boolean>>({})

  const [abaAtiva, setAbaAtiva]         = useState<Aba>('pedidos')
  const [filtroPedidos, setFiltroPedidos] = useState<FiltroPedidos>('todos')
  const [menuAberto, setMenuAberto]     = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [loja, setLoja]           = useState<LojaOwner | null | undefined>(undefined)
  const [ehOperador, setEhOperador] = useState(false)

  const [editandoSenha, setEditandoSenha]   = useState(false)
  const [formSenha, setFormSenha]           = useState({ nova: '', confirmar: '' })
  const [salvandoSenha, setSalvandoSenha]   = useState(false)
  const [erroSenha, setErroSenha]           = useState<string | null>(null)

  const [avaliacoesPedidoIds, setAvaliacoesPedidoIds] = useState<Set<string>>(new Set())
  const [pedidoAvaliar, setPedidoAvaliar] = useState<{
    id: string; lojaId: string; nomeLoja: string
  } | null>(null)

  const aplicarStatus = useCallback((id: string, status: OrderStatus) => {
    setPedidos(prev => prev.map(p => p.id === id && p.status !== status ? { ...p, status } : p))
  }, [])

  const carregarEnderecos = useCallback(async (clienteId: string) => {
    const { data } = await supabase.from('enderecos').select('*').eq('cliente_id', clienteId)
      .order('padrao', { ascending: false }).order('criado_em', { ascending: true })
    setEnderecos((data as Endereco[]) ?? [])
  }, [])

  const carregarPedidos = useCallback(async (clienteId: string) => {
    const { data } = await supabase.from('pedidos')
      .select('id,loja_id,status,total,criado_em,forma_pagamento,endereco_entrega,lojas(nome,slug,avaliacoes_ativas)')
      .eq('cliente_id', clienteId).order('criado_em', { ascending: false })
    const norm: Pedido[] = (data ?? []).map(p => {
      const lojaRef = (p as { lojas?: { nome?: string; slug?: string; avaliacoes_ativas?: boolean } | null }).lojas
      return {
        id: p.id as string, loja_id: p.loja_id as string,
        status: p.status as OrderStatus, total: p.total as number,
        criado_em: p.criado_em as string, forma_pagamento: p.forma_pagamento as string,
        endereco_entrega: p.endereco_entrega as string,
        loja_nome: lojaRef?.nome ?? 'Loja', loja_slug: lojaRef?.slug ?? '',
        loja_avaliacoes_ativas: lojaRef?.avaliacoes_ativas ?? true,
      }
    })
    setPedidos(norm)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/entrar?redirect=/conta'); return }
      setCliente({ id: user.id, nome: (user.user_metadata?.nome as string) ?? '', email: user.email ?? '' })
      await Promise.all([carregarEnderecos(user.id), carregarPedidos(user.id)])

      // Carrega quais pedidos já foram avaliados
      const { data: avalData } = await supabase
        .from('avaliacoes')
        .select('pedido_id')
        .eq('cliente_id', user.id)
      setAvaliacoesPedidoIds(new Set((avalData ?? []).map(a => a.pedido_id as string)))

      const { data: lojaData } = await supabase.from('lojas')
        .select('id,nome,slug,endereco,whatsapp,taxa_entrega,pedido_minimo,chave_pix,avaliacoes_ativas')
        .eq('dono_id', user.id).maybeSingle()
      setLoja(lojaData as LojaOwner | null)

      if (!lojaData) {
        const { data: opData } = await supabase
          .from('operadores')
          .select('loja_id')
          .eq('user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()
        if (opData) setEhOperador(true)
      }
    }
    init()
  }, [router, carregarEnderecos, carregarPedidos])

  // Realtime: status dos pedidos
  useEffect(() => {
    if (!cliente) return
    const canal = supabase.channel(`pedidos-cliente-${cliente.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `cliente_id=eq.${cliente.id}` },
        payload => { const n = payload.new as { id: string; status: OrderStatus }; aplicarStatus(n.id, n.status) })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [cliente, aplicarStatus])

  // Polling leve
  useEffect(() => {
    if (!cliente) return
    const id = setInterval(async () => {
      const { data } = await supabase.from('pedidos').select('id,status').eq('cliente_id', cliente.id)
      if (!data) return
      for (const p of data as { id: string; status: OrderStatus }[]) aplicarStatus(p.id, p.status)
    }, 20000)
    return () => clearInterval(id)
  }, [cliente, aplicarStatus])

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false)
    }
    if (menuAberto) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuAberto])

  async function handleTogglePedido(id: string) {
    const abrindo = expandidoPedido !== id
    setExpandidoPedido(abrindo ? id : null)
    if (abrindo && !itensPorPedido[id]) {
      setLoadingItens(prev => ({ ...prev, [id]: true }))
      const { data } = await supabase.from('itens_pedido').select('*').eq('pedido_id', id)
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
      cep: valores.cep.trim() || null,
      endereco: valores.endereco.trim(),
      complemento: valores.complemento.trim() || null,
      referencia: valores.referencia.trim() || null,
    }
    if (editando === 'novo') {
      await supabase.from('enderecos').insert({ ...payload, cliente_id: cliente.id, padrao: enderecos.length === 0 })
    } else if (editando) {
      await supabase.from('enderecos').update(payload).eq('id', editando)
    }
    await carregarEnderecos(cliente.id)
    setEditando(null)
    setSalvando(false)
  }

  async function handleExcluirConfirmar() {
    if (!cliente || !excluirId) return
    await supabase.from('enderecos').delete().eq('id', excluirId)
    await carregarEnderecos(cliente.id)
    setExcluirId(null)
  }

  async function handleMarcarPadrao(id: string) {
    if (!cliente) return
    await supabase.from('enderecos').update({ padrao: false }).eq('cliente_id', cliente.id)
    await supabase.from('enderecos').update({ padrao: true }).eq('id', id)
    await carregarEnderecos(cliente.id)
  }

  function handleAvaliacaoEnviada(pedidoId: string) {
    setAvaliacoesPedidoIds(prev => new Set([...prev, pedidoId]))
    setPedidoAvaliar(null)
  }

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErroSenha(null)
    if (formSenha.nova.length < 6) { setErroSenha('A senha deve ter ao menos 6 caracteres.'); return }
    if (formSenha.nova !== formSenha.confirmar) { setErroSenha('As senhas não coincidem.'); return }
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: formSenha.nova })
    setSalvandoSenha(false)
    if (error) { setErroSenha(error.message); return }
    setEditandoSenha(false)
    setFormSenha({ nova: '', confirmar: '' })
  }

  if (cliente === undefined) return null
  if (cliente === null) return null

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroPedidos === 'andamento') return ['recebido', 'preparando', 'saiu_entrega'].includes(p.status)
    if (filtroPedidos === 'concluidos') return ['entregue', 'cancelado'].includes(p.status)
    return true
  })

  const abas: { id: Aba; label: string }[] = [
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'enderecos', label: 'Endereços' },
    ...(loja ? [
      { id: 'loja' as Aba, label: 'Minha loja' },
      { id: 'operadores' as Aba, label: 'Operadores' },
      { id: 'integracoes' as Aba, label: 'Integrações' },
    ] : []),
  ]

  return (
    <div className="min-h-screen bg-bg flex flex-col animate-page-enter">

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
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuAberto(v => !v)}
                aria-label="Mais opções"
                title="Mais opções"
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <MoreHorizontal size={20} strokeWidth={1.75} className="text-ink-soft" />
              </button>
              {menuAberto && (
                <div className="animate-modal-in absolute right-0 top-12 w-48 bg-surface rounded-xl shadow-lg border border-line overflow-hidden z-50">
                  <button
                    onClick={() => { setMenuAberto(false); setEditandoSenha(true) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
                  >
                    <Key size={16} strokeWidth={1.75} className="text-ink-soft" />
                    Alterar senha
                  </button>
                  <button
                    onClick={handleSair}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ink-soft hover:bg-brand-50 transition-colors duration-150 border-t border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
                  >
                    <LogOut size={16} strokeWidth={1.75} />
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      <main>
        <PageContainer size="narrow" className="py-6 flex flex-col gap-6">

          {/* Card do usuário */}
          <div className="bg-surface rounded-xl px-4 py-5 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-2xl font-bold text-surface select-none leading-none">
                {(cliente.nome || cliente.email).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {cliente.nome && <p className="text-base font-bold text-ink leading-snug">{cliente.nome}</p>}
              <p className="text-sm text-ink-mute mt-0.5 truncate">{cliente.email}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-2 py-0.5 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                Conta ativa
              </span>
            </div>
          </div>

          {/* Acesso ao painel (operadores) */}
          {ehOperador && (
            <Link
              href="/painel"
              className="flex items-center gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-4 hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                <LayoutDashboard size={20} strokeWidth={1.75} className="text-surface" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-700">Acessar painel da loja</p>
                <p className="text-xs text-brand-600 mt-0.5">Você é operador desta loja</p>
              </div>
              <ChevronRight size={16} strokeWidth={2} className="text-brand-500 shrink-0" />
            </Link>
          )}

          {/* Modal alterar senha */}
          {editandoSenha && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40"
              onClick={() => setEditandoSenha(false)}
            >
              <form
                className="animate-modal-in bg-surface rounded-xl shadow-lg w-full max-w-sm p-6 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
                onSubmit={handleAlterarSenha}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock size={18} strokeWidth={1.75} className="text-brand-500" />
                    <h2 className="text-base font-semibold text-ink">Alterar senha</h2>
                  </div>
                  <button type="button" onClick={() => setEditandoSenha(false)} aria-label="Fechar"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors">
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>
                <Input id="nova-senha" label="Nova senha" type="password" placeholder="Mínimo 6 caracteres"
                  value={formSenha.nova} onChange={e => setFormSenha(f => ({ ...f, nova: e.target.value }))} />
                <Input id="confirmar-senha" label="Confirmar senha" type="password" placeholder="Repita a nova senha"
                  value={formSenha.confirmar} onChange={e => setFormSenha(f => ({ ...f, confirmar: e.target.value }))} />
                {erroSenha && <p className="text-xs text-danger">{erroSenha}</p>}
                <Button type="submit" variant="primary" disabled={salvandoSenha}>
                  {salvandoSenha ? 'Salvando…' : 'Alterar senha'}
                </Button>
              </form>
            </div>
          )}

          {/* Abas */}
          <div className="flex border-b border-line gap-1">
            {abas.map(aba => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={[
                  'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-t',
                  abaAtiva === aba.id
                    ? 'text-brand-700 border-brand-500'
                    : 'text-ink-soft border-transparent hover:text-ink hover:border-line',
                ].join(' ')}
              >
                {aba.label}
              </button>
            ))}
          </div>

          {/* Aba: Pedidos */}
          {abaAtiva === 'pedidos' && (
            <div className="flex flex-col gap-4">
              {/* Filtros */}
              <div className="flex gap-2">
                {([
                  { id: 'todos', label: 'Todos' },
                  { id: 'andamento', label: 'Em andamento' },
                  { id: 'concluidos', label: 'Concluídos' },
                ] as { id: FiltroPedidos; label: string }[]).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltroPedidos(f.id)}
                    className={[
                      'shrink-0 px-3.5 h-8 rounded-full text-xs font-medium transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      filtroPedidos === f.id
                        ? 'bg-brand-500 text-surface'
                        : 'bg-surface border border-line text-ink-soft hover:bg-brand-50',
                    ].join(' ')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {pedidos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-12 text-center flex flex-col items-center gap-3">
                  <ShoppingBag size={32} strokeWidth={1.25} className="text-ink-mute" />
                  <div>
                    <p className="text-sm font-semibold text-ink">Nenhum pedido ainda</p>
                    <p className="text-xs text-ink-mute mt-0.5">Explore nossas lojas e faça seu primeiro pedido.</p>
                  </div>
                  <Link href="/" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand-50 text-brand-700 text-sm font-medium hover:bg-brand-100 transition-colors">
                    Explorar lojas
                  </Link>
                </div>
              ) : pedidosFiltrados.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-12 text-center flex flex-col items-center gap-2">
                  <ShoppingBag size={32} strokeWidth={1.25} className="text-ink-mute" />
                  <p className="text-sm text-ink-soft">
                    {filtroPedidos === 'andamento' ? 'Nenhum pedido em andamento.' : 'Nenhum pedido concluído ainda.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pedidosFiltrados.map(p => (
                    <PedidoCard
                      key={p.id}
                      pedido={p}
                      itens={itensPorPedido[p.id]}
                      loadingItens={!!loadingItens[p.id]}
                      expandido={expandidoPedido === p.id}
                      avaliado={avaliacoesPedidoIds.has(p.id)}
                      onToggle={() => handleTogglePedido(p.id)}
                      onAvaliar={() => setPedidoAvaliar({ id: p.id, lojaId: p.loja_id, nomeLoja: p.loja_nome })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aba: Endereços */}
          {abaAtiva === 'enderecos' && (
            <SecaoEnderecos
              enderecos={enderecos}
              editando={editando}
              salvando={salvando}
              excluirId={excluirId}
              onEditar={setEditando}
              onCancelar={() => setEditando(null)}
              onSalvar={handleSalvar}
              onExcluirPedir={setExcluirId}
              onExcluirConfirmar={handleExcluirConfirmar}
              onExcluirCancelar={() => setExcluirId(null)}
              onMarcarPadrao={handleMarcarPadrao}
            />
          )}

          {/* Aba: Minha loja */}
          {abaAtiva === 'loja' && loja && (
            <SecaoLoja loja={loja} onAtualizar={setLoja} />
          )}

          {/* Aba: Operadores */}
          {abaAtiva === 'operadores' && loja && cliente && (
            <PlanGate feature="multiplos_operadores">
              <SecaoOperadores lojaId={loja.id} donoId={cliente.id} />
            </PlanGate>
          )}

          {/* Aba: Integrações */}
          {abaAtiva === 'integracoes' && loja && (
            <PlanGate feature="integracoes">
              <SecaoIntegracoes lojaId={loja.id} />
            </PlanGate>
          )}

        </PageContainer>
      </main>

      {pedidoAvaliar && cliente && (
        <ModalAvaliacao
          pedidoId={pedidoAvaliar.id}
          lojaId={pedidoAvaliar.lojaId}
          clienteId={cliente.id}
          nomeLoja={pedidoAvaliar.nomeLoja}
          onFechar={() => setPedidoAvaliar(null)}
          onEnviado={handleAvaliacaoEnviada}
        />
      )}
    </div>
  )
}

export default function ContaPage() {
  return (
    <PlanProvider>
      <ContaCliente />
    </PlanProvider>
  )
}
