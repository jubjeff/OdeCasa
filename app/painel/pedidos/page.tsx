'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, ChevronDown, ChevronUp, Phone, MapPin, Volume2, VolumeX, MessageCircle, ArrowRight, Ban } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { StatusBadge, type OrderStatus } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  MouseSensor, TouchSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'

/* ── Tipos ───────────────────────────────────────── */

interface Pedido {
  id: string
  loja_id: string
  nome_cliente: string
  telefone_cliente: string
  endereco_entrega: string
  status: OrderStatus
  forma_pagamento: string
  troco_para: number | null
  subtotal: number
  taxa_entrega: number
  total: number
  observacoes: string | null
  criado_em: string
}

interface ItemPedido {
  pedido_id: string
  nome_produto: string
  preco_unitario: number
  unidade: string
  quantidade: number
  subtotal: number
}

/* ── Constantes ──────────────────────────────────── */

const COLUNAS: { status: OrderStatus; titulo: string; corDot: string }[] = [
  { status: 'recebido',    titulo: 'Recebido',           corDot: 'bg-ink-mute'  },
  { status: 'preparando',  titulo: 'Preparando',         corDot: 'bg-accent'    },
  { status: 'saiu_entrega',titulo: 'Saiu para entrega',  corDot: 'bg-brand-300' },
  { status: 'entregue',    titulo: 'Entregue',           corDot: 'bg-brand-500' },
  { status: 'cancelado',   titulo: 'Cancelado',          corDot: 'bg-danger'    },
]

const PROXIMO: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  recebido:    { status: 'preparando',   label: 'Iniciar preparo'   },
  preparando:  { status: 'saiu_entrega', label: 'Saiu para entrega' },
  saiu_entrega:{ status: 'entregue',     label: 'Marcar entregue'   },
}

const LABEL_PAGAMENTO: Record<string, string> = {
  dinheiro:      'Dinheiro',
  pix:           'Pix',
  cartao_entrega:'Cartão na entrega',
}

const LABEL_STATUS: Record<OrderStatus, string> = {
  recebido:    'Recebido',
  preparando:  'Preparando',
  saiu_entrega:'Saiu para entrega',
  entregue:    'Entregue',
  cancelado:   'Cancelado',
}

const LABEL_WHATSAPP: Record<OrderStatus, string> = {
  recebido:    'Avisar: pedido recebido',
  preparando:  'Avisar: em preparo',
  saiu_entrega:'Avisar: saiu para entrega',
  entregue:    'Avisar: entregue',
  cancelado:   'Avisar: cancelado',
}

/* ── Helpers ─────────────────────────────────────── */

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatarQtd(qtd: number, unidade: string): string {
  if (unidade === 'kg')
    return qtd.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return String(qtd)
}

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function telefoneValido(tel: string | null | undefined): boolean {
  if (!tel) return false
  return tel.replace(/\D/g, '').length >= 8
}

function montarLinkWhatsApp(pedido: Pedido, nomeLoja: string): string {
  const numero = normalizarTelefone(pedido.telefone_cliente)
  const nome = pedido.nome_cliente
  const loja = nomeLoja || 'nossa loja'
  const mensagens: Record<OrderStatus, string> = {
    recebido:    `Olá ${nome}! 🛒 Recebemos seu pedido na ${loja} e já estamos confirmando. Em breve começamos a preparar. Obrigado!`,
    preparando:  `Oi ${nome}! 👨‍🍳 Seu pedido na ${loja} já está sendo preparado. Logo sai para entrega!`,
    saiu_entrega:`${nome}, seu pedido da ${loja} saiu para entrega! 🛵 Já está a caminho do seu endereço.`,
    entregue:    `Pedido entregue! ✅ Esperamos que você goste, ${nome}. Obrigado por comprar na ${loja} 💚`,
    cancelado:   `Olá ${nome}, seu pedido na ${loja} foi cancelado. Qualquer dúvida, é só falar com a gente.`,
  }
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagens[pedido.status])}`
}

function idCurto(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

function resumoItens(itens: ItemPedido[] | undefined): string {
  if (!itens || itens.length === 0) return ''
  const partes = itens.map(i => `${formatarQtd(i.quantidade, i.unidade)}x ${i.nome_produto}`)
  const MAX = 3
  return partes.length <= MAX ? partes.join(', ') : `${partes.slice(0, MAX).join(', ')}…`
}

function minutosDesde(iso: string, agora: number): number {
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000))
}

function tempoDecorrido(min: number): string {
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `há ${h}h${String(m).padStart(2, '0')}` : `há ${h}h`
}

/* Faixa de urgência (só em pedidos ativos): <20min verde, 20–40 accent, >40 danger */
function corUrgencia(min: number, status: OrderStatus): string {
  if (status !== 'recebido' && status !== 'preparando') return ''
  if (min > 40) return 'border-l-4 border-danger'
  if (min >= 20) return 'border-l-4 border-accent'
  return 'border-l-4 border-brand-500'
}

/* Botão de ação em ícone (tooltip nativo via title) */
function AcaoIcone({
  title, onClick, disabled, danger, children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        'disabled:opacity-40 disabled:pointer-events-none',
        danger ? 'text-danger hover:bg-danger/10' : 'text-brand-700 hover:bg-brand-50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/* ── Card de pedido ──────────────────────────────── */

interface CardPedidoProps {
  pedido: Pedido
  itens: ItemPedido[] | undefined
  loadingItens: boolean
  expandido: boolean
  atualizandoStatus: boolean
  novo: boolean
  nomeLoja: string
  whatsappRealcado: boolean
  agora: number
  onToggle: () => void
  onAvancar: (novoStatus: OrderStatus) => void
  onIniciarCancelar: () => void
}

function CardPedido({
  pedido, itens, loadingItens, expandido, atualizandoStatus, novo,
  nomeLoja, whatsappRealcado, agora,
  onToggle, onAvancar, onIniciarCancelar,
}: CardPedidoProps) {
  const proximo = PROXIMO[pedido.status]
  const podeAvancar = !!proximo
  const podeCancelar = pedido.status !== 'cancelado' && pedido.status !== 'entregue'
  const temTelefone = telefoneValido(pedido.telefone_cliente)
  const waLink = temTelefone ? montarLinkWhatsApp(pedido, nomeLoja) : undefined

  const min = minutosDesde(pedido.criado_em, agora)
  const resumo = resumoItens(itens)

  return (
    <div className={[
      'rounded-xl overflow-hidden transition-shadow duration-200',
      corUrgencia(min, pedido.status),
      novo ? 'bg-brand-100 shadow-md ring-2 ring-brand-300' : 'bg-surface shadow-sm hover:shadow-md',
    ].join(' ')}>

      {/* Resumo escaneável (clicável para expandir) */}
      <button
        onClick={onToggle}
        aria-expanded={expandido}
        className="w-full text-left px-4 pt-3 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink">#{idCurto(pedido.id)}</span>
          <StatusBadge status={pedido.status} />
        </div>

        <p className="text-sm font-semibold text-ink mt-1.5 truncate">{pedido.nome_cliente}</p>

        {resumo && (
          <p className="text-xs text-ink-soft mt-0.5 leading-snug line-clamp-2">{resumo}</p>
        )}

        <p className="flex items-center gap-1 text-xs text-ink-mute mt-1">
          <MapPin size={12} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{pedido.endereco_entrega}</span>
        </p>

        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="text-[15px] font-bold text-brand-700">{formatarReal(pedido.total)}</span>
          <span className="text-xs text-ink-mute" title={formatarData(pedido.criado_em)}>
            {tempoDecorrido(min)}
          </span>
        </div>
      </button>

      {/* Ações em ícone (tooltip via title) */}
      <div className="flex items-center gap-1 px-3 pb-2.5">
        {podeAvancar && (
          <AcaoIcone
            title={proximo!.label}
            onClick={() => onAvancar(proximo!.status)}
            disabled={atualizandoStatus}
          >
            <ArrowRight size={16} strokeWidth={2} />
          </AcaoIcone>
        )}

        <a
          href={waLink ?? '#'}
          target={waLink ? '_blank' : undefined}
          rel="noopener noreferrer"
          title={temTelefone ? LABEL_WHATSAPP[pedido.status] : 'Cliente sem telefone'}
          aria-label={temTelefone ? LABEL_WHATSAPP[pedido.status] : 'Cliente sem telefone'}
          aria-disabled={!temTelefone}
          tabIndex={temTelefone ? 0 : -1}
          onClick={!temTelefone ? (e) => e.preventDefault() : undefined}
          className={[
            'w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            whatsappRealcado
              ? 'bg-brand-500 text-surface ring-2 ring-brand-200'
              : temTelefone
                ? 'text-brand-700 hover:bg-brand-50'
                : 'text-ink-mute opacity-50 pointer-events-none',
          ].join(' ')}
        >
          <MessageCircle size={16} strokeWidth={1.75} />
        </a>

        {podeCancelar && (
          <AcaoIcone
            title="Cancelar pedido"
            onClick={onIniciarCancelar}
            disabled={atualizandoStatus}
            danger
          >
            <Ban size={16} strokeWidth={1.75} />
          </AcaoIcone>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label={expandido ? 'Recolher detalhes' : 'Ver detalhes'}
          className="ml-auto w-9 h-9 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {expandido ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
        </button>
      </div>

      {/* Detalhes expandidos */}
      {expandido && (
        <div className="border-t border-line px-4 pb-4 pt-3 space-y-4">

          {/* Itens */}
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">Itens do pedido</p>
            {loadingItens ? (
              <p className="text-xs text-ink-mute">Carregando itens…</p>
            ) : itens && itens.length > 0 ? (
              <div className="space-y-1.5">
                {itens.map((item, i) => (
                  <div key={i} className="flex justify-between items-baseline gap-2">
                    <span className="text-sm text-ink flex-1 min-w-0 truncate">
                      {item.nome_produto}
                      <span className="text-ink-mute ml-1">× {formatarQtd(item.quantidade, item.unidade)}</span>
                    </span>
                    <span className="text-sm font-medium text-ink shrink-0">{formatarReal(item.subtotal)}</span>
                  </div>
                ))}

                <div className="border-t border-line pt-1.5 space-y-1">
                  <div className="flex justify-between text-xs text-ink-soft">
                    <span>Subtotal</span>
                    <span>{formatarReal(pedido.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-ink-soft">
                    <span>Taxa de entrega</span>
                    <span className={pedido.taxa_entrega === 0 ? 'text-brand-600 font-medium' : ''}>
                      {pedido.taxa_entrega === 0 ? 'Grátis' : formatarReal(pedido.taxa_entrega)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-mute">Sem itens registrados</p>
            )}
          </div>

          {/* Detalhes de entrega */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin size={13} strokeWidth={1.75} className="text-ink-mute shrink-0 mt-0.5" />
              <p className="text-sm text-ink-soft leading-snug">{pedido.endereco_entrega}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={13} strokeWidth={1.75} className="text-ink-mute shrink-0" />
              <p className="text-sm text-ink-soft">{pedido.telefone_cliente}</p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Pagamento</span>
              <span className="text-ink font-medium">
                {LABEL_PAGAMENTO[pedido.forma_pagamento] ?? pedido.forma_pagamento}
              </span>
            </div>
            {pedido.troco_para != null && (
              <p className="text-sm text-ink-soft">
                <span className="font-medium text-ink">Troco para:</span>{' '}
                {formatarReal(pedido.troco_para)}
              </p>
            )}
            {pedido.observacoes && (
              <p className="text-sm text-ink-soft leading-snug">
                <span className="font-medium text-ink">Obs:</span> {pedido.observacoes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Wrapper arrastável ──────────────────────────── */

function CardArrastavel({ id, status, children }: { id: string; status: OrderStatus; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { status } })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'}
    >
      {children}
    </div>
  )
}

/* ── Coluna do kanban ────────────────────────────── */

interface KanbanColunaProps {
  status: OrderStatus
  titulo: string
  corDot: string
  pedidos: Pedido[]
  expandido: string | null
  itensPorPedido: Record<string, ItemPedido[]>
  loadingItens: Record<string, boolean>
  atualizandoStatus: string | null
  novosIds: Set<string>
  nomeLoja: string
  whatsappRealcado: Set<string>
  agora: number
  onToggle: (id: string) => void
  onAvancar: (id: string, status: OrderStatus) => void
  onIniciarCancelar: (id: string) => void
}

function KanbanColuna({
  status, titulo, corDot, pedidos,
  expandido, itensPorPedido, loadingItens, atualizandoStatus, novosIds,
  nomeLoja, whatsappRealcado, agora,
  onToggle, onAvancar, onIniciarCancelar,
}: KanbanColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="w-72 shrink-0 flex flex-col gap-2">
      {/* Cabeçalho da coluna */}
      <div className="flex items-center gap-2 px-0.5 pb-1">
        <span className={`w-2 h-2 rounded-full ${corDot} shrink-0`} aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">{titulo}</span>
        <span className="ml-auto min-w-[20px] text-center text-xs font-medium text-ink-mute bg-line rounded-full px-2 py-0.5">
          {pedidos.length}
        </span>
      </div>

      {/* Área droppable */}
      <div
        ref={setNodeRef}
        className={[
          'flex flex-col gap-2 rounded-xl min-h-[64px] transition-colors duration-150',
          isOver ? 'ring-2 ring-brand-300 bg-brand-50/60 p-1' : '',
        ].join(' ')}
      >
        {pedidos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-8 text-center">
            <p className="text-xs text-ink-mute">Sem pedidos</p>
          </div>
        ) : (
          pedidos.map(p => (
            <CardArrastavel key={p.id} id={p.id} status={p.status}>
              <CardPedido
                pedido={p}
                itens={itensPorPedido[p.id]}
                loadingItens={!!loadingItens[p.id]}
                expandido={expandido === p.id}
                atualizandoStatus={atualizandoStatus === p.id}
                novo={novosIds.has(p.id)}
                nomeLoja={nomeLoja}
                whatsappRealcado={whatsappRealcado.has(p.id)}
                agora={agora}
                onToggle={() => onToggle(p.id)}
                onAvancar={status => onAvancar(p.id, status)}
                onIniciarCancelar={() => onIniciarCancelar(p.id)}
              />
            </CardArrastavel>
          ))
        )}
      </div>
    </div>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function PainelPedidos() {
  const router = useRouter()

  const [lojaId, setLojaId]     = useState<string | null | undefined>(undefined)
  const [nomeLoja, setNomeLoja]  = useState<string>('')
  const [pedidos, setPedidos]    = useState<Pedido[]>([])
  const [carregando, setCarregando]   = useState(true)
  const [atualizando, setAtualizando] = useState(false)

  const [expandido, setExpandido]     = useState<string | null>(null)
  const [itensPorPedido, setItensPorPedido]   = useState<Record<string, ItemPedido[]>>({})
  const [loadingItens, setLoadingItens]       = useState<Record<string, boolean>>({})
  const [atualizandoStatus, setAtualizandoStatus] = useState<string | null>(null)
  const [confirmCancelar, setConfirmCancelar] = useState<string | null>(null)
  const [novosIds, setNovosIds]               = useState<Set<string>>(new Set())
  const [whatsappRealcado, setWhatsappRealcado] = useState<Set<string>>(new Set())

  /* Drag-and-drop entre colunas */
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  /* Relógio para o "tempo decorrido" — atualiza a cada 30s */
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  /* ── Áudio ───────────────────────────────────────── */
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [somAtivo, setSomAtivo] = useState(false)

  /* IDs conhecidos no momento do carregamento inicial; null = ainda não carregou */
  const pedidosConhecidosRef = useRef<Set<string> | null>(null)

  /* useCallback vazio = referência estável; audioCtxRef é um ref, logo sem deps */
  const tocarDing = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state === 'closed') return

    function play() {
      const t = ctx!.currentTime
      function nota(freq: number, inicio: number, fim: number, vol: number) {
        const osc = ctx!.createOscillator()
        const gain = ctx!.createGain()
        osc.connect(gain)
        gain.connect(ctx!.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, t + inicio)
        gain.gain.linearRampToValueAtTime(vol, t + inicio + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, t + fim)
        osc.start(t + inicio)
        osc.stop(t + fim)
      }
      nota(880,  0,    0.30, 0.28)  /* A5  — primeiro toque  */
      nota(1109, 0.12, 0.55, 0.22)  /* C#6 — segundo toque   */
    }

    if (ctx.state === 'running') {
      play()
    } else {
      /* 'suspended': acontece quando a aba vai para segundo plano */
      ctx.resume().then(play).catch(() => {})
    }
  }, [])

  function handleAtivarSom() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      audioCtxRef.current.resume().then(() => {
        tocarDing()
        setSomAtivo(true)
      })
    } catch {
      /* Web Audio API indisponível */
    }
  }

  const carregarPedidos = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('loja_id', id)
      .order('criado_em', { ascending: false })
    if (!data) return
    setPedidos(data as Pedido[])

    // Carrega os itens de todos os pedidos (para o resumo no card)
    const ids = (data as Pedido[]).map(p => p.id)
    if (ids.length > 0) {
      const { data: itensData } = await supabase
        .from('itens_pedido')
        .select('*')
        .in('pedido_id', ids)
      const mapa: Record<string, ItemPedido[]> = {}
      for (const it of (itensData as ItemPedido[] | null) ?? []) {
        (mapa[it.pedido_id] ??= []).push(it)
      }
      setItensPorPedido(mapa)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: lojaData } = await supabase
        .from('lojas')
        .select('id, nome')
        .eq('dono_id', user.id)
        .maybeSingle()

      if (!lojaData) { setLojaId(null); setCarregando(false); return }

      setLojaId(lojaData.id)
      setNomeLoja(lojaData.nome ?? '')
      await carregarPedidos(lojaData.id)
      setCarregando(false)
    }

    init()
  }, [router, carregarPedidos])

  /* Realtime — trata INSERT/UPDATE/DELETE individualmente */
  useEffect(() => {
    if (!lojaId) return

    const channel = supabase
      .channel('pedidos-loja')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const entrante = payload.new as Pedido
            setPedidos(prev =>
              prev.some(p => p.id === entrante.id) ? prev : [entrante, ...prev]
            )
          } else if (payload.eventType === 'UPDATE') {
            const atualizado = payload.new as Pedido
            setPedidos(prev =>
              prev.map(p => p.id === atualizado.id ? atualizado : p)
            )
          } else if (payload.eventType === 'DELETE') {
            const deletado = payload.old as Pick<Pedido, 'id'>
            setPedidos(prev => prev.filter(p => p.id !== deletado.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lojaId])

  /* Refresh automático a cada 30 s — fallback caso o realtime falhe */
  useEffect(() => {
    if (!lojaId) return
    const timer = setInterval(() => carregarPedidos(lojaId), 30_000)
    return () => clearInterval(timer)
  }, [lojaId, carregarPedidos])

  /*
   * Detecta pedidos novos em qualquer atualização da lista
   * (realtime INSERT, polling de 30 s ou botão Atualizar).
   * Toca o ding e aplica o destaque visual para cada pedido
   * que não existia na última vez que a lista foi observada.
   */
  useEffect(() => {
    const idsAtuais = new Set(pedidos.map(p => p.id))

    if (pedidosConhecidosRef.current === null) {
      /* Primeira carga: registra os IDs existentes sem tocar nada */
      pedidosConhecidosRef.current = idsAtuais
      return
    }

    const novos = pedidos.filter(p => !pedidosConhecidosRef.current!.has(p.id))
    pedidosConhecidosRef.current = idsAtuais

    if (novos.length === 0) return

    /* Destaque visual por 4 s com fade de 700 ms */
    setNovosIds(prev => {
      const s = new Set(prev)
      novos.forEach(p => s.add(p.id))
      return s
    })
    novos.forEach(({ id }) => {
      setTimeout(() => {
        setNovosIds(prev => { const s = new Set(prev); s.delete(id); return s })
      }, 4000)
    })

    /* Som */
    tocarDing()
  }, [pedidos, tocarDing])

  async function handleAtualizar() {
    if (!lojaId) return
    setAtualizando(true)
    await carregarPedidos(lojaId)
    setAtualizando(false)
  }

  async function handleToggle(pedidoId: string) {
    const abrindo = expandido !== pedidoId
    setExpandido(abrindo ? pedidoId : null)

    if (abrindo && !itensPorPedido[pedidoId]) {
      setLoadingItens(prev => ({ ...prev, [pedidoId]: true }))
      const { data } = await supabase
        .from('itens_pedido')
        .select('*')
        .eq('pedido_id', pedidoId)
      setItensPorPedido(prev => ({ ...prev, [pedidoId]: (data as ItemPedido[]) ?? [] }))
      setLoadingItens(prev => ({ ...prev, [pedidoId]: false }))
    }
  }

  async function handleAvancarStatus(pedidoId: string, novoStatus: OrderStatus, mensagemSucesso?: string) {
    setAtualizandoStatus(pedidoId)
    /* Atualização otimista — move o card imediatamente */
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, status: novoStatus } : p))

    const { error } = await supabase
      .from('pedidos')
      .update({ status: novoStatus })
      .eq('id', pedidoId)

    if (error) {
      console.error('[OdeCasa] Erro ao atualizar status:', error)
      if (lojaId) carregarPedidos(lojaId) /* reverte em caso de falha */
      toast.error('Não foi possível atualizar o pedido')
    } else {
      /* Realça o botão WhatsApp por 5 s para lembrar de avisar o cliente */
      setWhatsappRealcado(prev => { const s = new Set(prev); s.add(pedidoId); return s })
      setTimeout(() => {
        setWhatsappRealcado(prev => { const s = new Set(prev); s.delete(pedidoId); return s })
      }, 5000)
      toast.success(mensagemSucesso ?? `Pedido marcado como “${LABEL_STATUS[novoStatus]}”`)
    }
    setAtualizandoStatus(null)
  }

  async function handleConfirmarCancelar() {
    const id = confirmCancelar
    setConfirmCancelar(null)
    if (id) await handleAvancarStatus(id, 'cancelado')
  }

  function handleDragEnd(e: DragEndEvent) {
    setArrastandoId(null)
    const { active, over } = e
    if (!over) return
    const pedidoId = String(active.id)
    const origem = active.data.current?.status as OrderStatus | undefined
    const destino = over.id as OrderStatus
    if (!destino || destino === origem) return
    // Cancelar continua passando pelo modal de confirmação
    if (destino === 'cancelado') { setConfirmCancelar(pedidoId); return }
    handleAvancarStatus(pedidoId, destino, `Pedido #${idCurto(pedidoId)} movido para “${LABEL_STATUS[destino]}”`)
  }

  const pedidoArrastado = arrastandoId ? pedidos.find(p => p.id === arrastandoId) : null

  /* ── Estados de carregamento / erro ──────────────── */

  if (lojaId === undefined || carregando) {
    return (
      <div className="flex gap-4 px-4 py-5 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, c) => (
          <div key={c} className="w-72 shrink-0 flex flex-col gap-2">
            <Skeleton className="h-5 w-32 mb-1" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-xl shadow-sm p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (lojaId === null) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <p className="text-base font-semibold text-ink">Crie sua loja primeiro</p>
          <p className="text-sm text-ink-soft mt-1 mb-5 leading-relaxed">
            Você precisa ter uma loja cadastrada para gerenciar pedidos.
          </p>
          <Button onClick={() => router.push('/painel')}>Ir para o painel</Button>
        </div>
      </main>
    )
  }

  /* ── Render principal ─────────────────────────────── */

  return (
    <div className="flex flex-col">

      {/* Toolbar de ações da página (navegação fica na sidebar) */}
      <div className="px-4 h-12 flex items-center justify-end gap-1 border-b border-line bg-surface">
        {/* Indicador / botão de som */}
        {somAtivo ? (
          <div
            aria-label="Som de pedidos ativo"
            className="w-10 h-10 flex items-center justify-center"
          >
            <Volume2 size={18} strokeWidth={1.75} className="text-brand-500" />
          </div>
        ) : (
          <IconButton onClick={handleAtivarSom} aria-label="Ativar som de pedidos">
            <VolumeX size={18} strokeWidth={1.75} className="text-ink-mute" />
          </IconButton>
        )}

        <IconButton
          onClick={handleAtualizar}
          disabled={atualizando}
          aria-label="Atualizar pedidos"
        >
          <RefreshCw
            size={18}
            strokeWidth={1.75}
            className={`text-ink ${atualizando ? 'animate-spin' : ''}`}
          />
        </IconButton>
      </div>

      {/* Banner de ativação de som — desaparece após ativar */}
      {!somAtivo && (
        <div className="bg-brand-50 border-b border-line px-4 py-2.5 flex items-center gap-3">
          <VolumeX size={15} strokeWidth={1.75} className="text-brand-600 shrink-0" />
          <p className="text-sm text-ink-soft flex-1 leading-snug">
            Ative o som para ser avisado quando chegar um pedido novo.
          </p>
          <button
            onClick={handleAtivarSom}
            className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
          >
            Ativar
          </button>
        </div>
      )}

      {/* Kanban — rolagem horizontal com drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={e => setArrastandoId(String(e.active.id))}
        onDragCancel={() => setArrastandoId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 px-4 py-5 pb-10 min-w-max">
            {COLUNAS.map(col => (
              <KanbanColuna
                key={col.status}
                status={col.status}
                titulo={col.titulo}
                corDot={col.corDot}
                pedidos={pedidos.filter(p => p.status === col.status)}
                expandido={expandido}
                itensPorPedido={itensPorPedido}
                loadingItens={loadingItens}
                atualizandoStatus={atualizandoStatus}
                novosIds={novosIds}
                nomeLoja={nomeLoja}
                whatsappRealcado={whatsappRealcado}
                agora={agora}
                onToggle={handleToggle}
                onAvancar={handleAvancarStatus}
                onIniciarCancelar={id => setConfirmCancelar(id)}
              />
            ))}
          </div>
        </div>

        {/* Prévia semitransparente durante o arraste */}
        <DragOverlay>
          {pedidoArrastado ? (
            <div className="w-72 bg-surface rounded-xl shadow-lg ring-2 ring-brand-300 p-4 rotate-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">#{idCurto(pedidoArrastado.id)}</span>
                <StatusBadge status={pedidoArrastado.status} />
              </div>
              <p className="text-sm font-semibold text-ink mt-1.5 truncate">{pedidoArrastado.nome_cliente}</p>
              <p className="text-[15px] font-bold text-brand-700 mt-1">{formatarReal(pedidoArrastado.total)}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Diálogo de confirmação de cancelamento */}
      {confirmCancelar && (
        <ConfirmDialog
          mensagem="Tem certeza que deseja cancelar este pedido? Essa ação não pode ser desfeita."
          labelConfirmar="Cancelar pedido"
          onConfirmar={handleConfirmarCancelar}
          onCancelar={() => setConfirmCancelar(null)}
        />
      )}
    </div>
  )
}
