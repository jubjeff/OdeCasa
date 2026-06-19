'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, MouseSensor, TouchSensor,
  useSensor, useSensors, closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { useRole } from '@/hooks/useRole'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ModalPedidoManual } from '@/components/painel/ModalPedidoManual'
import { OrdersHeader } from '@/components/pedidos/OrdersHeader'
import { OrdersKanban } from '@/components/pedidos/OrdersKanban'
import { OrderDetailSheet } from '@/components/pedidos/OrderDetailSheet'
import { OrderPrintView } from '@/components/pedidos/OrderPrintView'
import { CancelledList } from '@/components/pedidos/CancelledList'
import { EmptyOrders } from '@/components/pedidos/EmptyOrders'
import type { OrderStatus } from '@/components/ui/StatusBadge'
import {
  STATUS_LABEL,
  shortId,
  type ItemPedido,
  type Pedido,
} from '@/lib/pedidos/format'

/* ── Constantes ──────────────────────────────────── */

type FiltroData   = 'hoje' | 'ontem' | '7dias'
type FiltroOrigem = 'todos' | 'delivery' | 'manual'

const STATUS_ATIVOS: OrderStatus[]      = ['recebido', 'preparando', 'saiu_entrega']
const STATUS_FINALIZADOS: OrderStatus[] = ['entregue', 'cancelado']

const SOM_AVISADO_KEY = 'odecasa_som_avisado'

/* ── Helpers de data ─────────────────────────────── */

function inicioDoDia(offsetDias = 0): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (offsetDias !== 0) d.setDate(d.getDate() + offsetDias)
  return d
}

function rangeParaFiltro(filtro: FiltroData): { gte: string; lt?: string } {
  switch (filtro) {
    case 'hoje':  return { gte: inicioDoDia().toISOString() }
    case 'ontem': return { gte: inicioDoDia(-1).toISOString(), lt: inicioDoDia().toISOString() }
    case '7dias': return { gte: inicioDoDia(-6).toISOString() }
  }
}

/* ── Página ──────────────────────────────────────── */

export default function PainelPedidos() {
  const router = useRouter()
  const { lojaId, isLoading: roleLoading, hasRole } = useRole()

  const [nomeLoja, setNomeLoja]   = useState<string>('')
  const [pedidos, setPedidos]     = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)

  const [filtroData, setFiltroData]       = useState<FiltroData>('hoje')
  const [filtroOrigem, setFiltroOrigem]   = useState<FiltroOrigem>('todos')
  const [verCancelados, setVerCancelados] = useState(false)
  const [modalAberto, setModalAberto]     = useState(false)
  const filtroDataRef = useRef<FiltroData>('hoje')

  const [itensPorPedido, setItensPorPedido] = useState<Record<string, ItemPedido[]>>({})
  const [atualizandoStatus, setAtualizandoStatus] = useState<string | null>(null)
  const [confirmCancelar, setConfirmCancelar]     = useState<string | null>(null)
  const [novosIds, setNovosIds]         = useState<Set<string>>(new Set())
  const [detalheId, setDetalheId]       = useState<string | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [imprimindoId, setImprimindoId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  /* ── Áudio ───────────────────────────────────────── */

  const audioCtxRef = useRef<AudioContext | null>(null)
  const [somAtivo, setSomAtivo] = useState(false)
  const pedidosConhecidosRef = useRef<Set<string> | null>(null)

  const tocarDing = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state === 'closed') return

    function play() {
      const t = ctx!.currentTime
      function nota(freq: number, inicio: number, fim: number, vol: number) {
        const osc  = ctx!.createOscillator()
        const gain = ctx!.createGain()
        osc.connect(gain); gain.connect(ctx!.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0, t + inicio)
        gain.gain.linearRampToValueAtTime(vol, t + inicio + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, t + fim)
        osc.start(t + inicio); osc.stop(t + fim)
      }
      nota(880,  0,    0.30, 0.28)
      nota(1109, 0.12, 0.55, 0.22)
    }

    ctx.state === 'running' ? play() : ctx.resume().then(play).catch(() => {})
  }, [])

  function handleAtivarSom() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      audioCtxRef.current.resume().then(() => {
        tocarDing()
        setSomAtivo(true)
        // Marcar toast de som como visto
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(SOM_AVISADO_KEY, '1')
        }
      })
    } catch { /* Web Audio API indisponível */ }
  }

  /* ── Carrega pedidos ─────────────────────────────── */

  const carregarPedidos = useCallback(async (id: string, filtro: FiltroData) => {
    const range = rangeParaFiltro(filtro)

    let queryFinalizados = supabase
      .from('pedidos').select('*').eq('loja_id', id)
      .in('status', STATUS_FINALIZADOS)
      .gte('criado_em', range.gte)
      .order('criado_em', { ascending: false })

    if (range.lt) queryFinalizados = queryFinalizados.lt('criado_em', range.lt)

    const [{ data: ativos }, { data: finalizados }] = await Promise.all([
      supabase.from('pedidos').select('*').eq('loja_id', id)
        .in('status', STATUS_ATIVOS).order('criado_em', { ascending: false }),
      queryFinalizados,
    ])

    const todos = [...(ativos ?? []), ...(finalizados ?? [])]
      .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())

    setPedidos(todos as Pedido[])

    const ids = todos.map(p => p.id)
    if (ids.length === 0) return

    const { data: itensData } = await supabase
      .from('itens_pedido').select('*').in('pedido_id', ids)

    const mapa: Record<string, ItemPedido[]> = {}
    for (const it of (itensData as ItemPedido[] | null) ?? []) {
      (mapa[it.pedido_id] ??= []).push(it)
    }
    setItensPorPedido(mapa)
  }, [])

  /* ── Efeitos de inicialização ────────────────────── */

  useEffect(() => {
    if (!lojaId) return
    supabase.from('lojas').select('nome').eq('id', lojaId).single()
      .then(({ data }) => { if (data) setNomeLoja((data as { nome: string }).nome ?? '') })
  }, [lojaId])

  useEffect(() => {
    if (!lojaId) return
    carregarPedidos(lojaId, 'hoje').then(() => setCarregando(false))
  }, [lojaId, carregarPedidos])

  useEffect(() => {
    filtroDataRef.current = filtroData
    if (lojaId) carregarPedidos(lojaId, filtroData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroData])

  /* ── Toast de som (apenas primeira visita) ───────── */

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    const jaViu = localStorage.getItem(SOM_AVISADO_KEY)
    if (!jaViu && !somAtivo) {
      const t = setTimeout(() => {
        toast('Ative o som para ser avisado de novos pedidos', {
          action: {
            label: 'Ativar',
            onClick: handleAtivarSom,
          },
          duration: 8000,
          onDismiss: () => localStorage.setItem(SOM_AVISADO_KEY, '1'),
        })
        localStorage.setItem(SOM_AVISADO_KEY, '1')
      }, 1500)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Realtime ────────────────────────────────────── */

  useEffect(() => {
    if (!lojaId) return

    const channel = supabase
      .channel('pedidos-loja')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const entrante = payload.new as Pedido
            setPedidos(prev =>
              prev.some(p => p.id === entrante.id) ? prev : [entrante, ...prev]
            )
          } else if (payload.eventType === 'UPDATE') {
            const atualizado = payload.new as Pedido
            setPedidos(prev => prev.map(p => p.id === atualizado.id ? atualizado : p))
          } else if (payload.eventType === 'DELETE') {
            const deletado = payload.old as Pick<Pedido, 'id'>
            setPedidos(prev => prev.filter(p => p.id !== deletado.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lojaId])

  /* Refresh automático a cada 30 s */
  useEffect(() => {
    if (!lojaId) return
    const timer = setInterval(() => carregarPedidos(lojaId, filtroDataRef.current), 30_000)
    return () => clearInterval(timer)
  }, [lojaId, carregarPedidos])

  /* Detecta pedidos novos */
  useEffect(() => {
    const idsAtuais = new Set(pedidos.map(p => p.id))
    if (pedidosConhecidosRef.current === null) {
      pedidosConhecidosRef.current = idsAtuais; return
    }
    const novos = pedidos.filter(p => !pedidosConhecidosRef.current!.has(p.id))
    pedidosConhecidosRef.current = idsAtuais
    if (novos.length === 0) return

    setNovosIds(prev => {
      const s = new Set(prev); novos.forEach(p => s.add(p.id)); return s
    })
    novos.forEach(({ id }) => {
      setTimeout(() => {
        setNovosIds(prev => { const s = new Set(prev); s.delete(id); return s })
      }, 5000)
    })
    tocarDing()
  }, [pedidos, tocarDing])

  /* ── Impressão ───────────────────────────────────── */

  useEffect(() => {
    if (!imprimindoId) return
    const t = setTimeout(() => window.print(), 120)
    return () => clearTimeout(t)
  }, [imprimindoId])

  useEffect(() => {
    function limpar() { setImprimindoId(null) }
    window.addEventListener('afterprint', limpar)
    return () => window.removeEventListener('afterprint', limpar)
  }, [])

  /* ── Handlers ────────────────────────────────────── */

  async function handleAtualizar() {
    if (!lojaId) return
    setAtualizando(true)
    await carregarPedidos(lojaId, filtroDataRef.current)
    setAtualizando(false)
  }

  async function handleAvancarStatus(pedidoId: string, novoStatus: OrderStatus) {
    setAtualizandoStatus(pedidoId)
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, status: novoStatus } : p))

    const { error } = await supabase
      .from('pedidos').update({ status: novoStatus }).eq('id', pedidoId)

    if (error) {
      console.error('[OdeCasa] Erro ao atualizar status:', error)
      if (lojaId) carregarPedidos(lojaId, filtroDataRef.current)
      toast.error('Não foi possível atualizar o pedido')
    } else {
      toast.success(`Pedido #${shortId(pedidoId)} → "${STATUS_LABEL[novoStatus]}"`)
      fetch('/api/webhook/disparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loja_id: lojaId,
          evento: novoStatus === 'cancelado' ? 'pedido.cancelado' : 'pedido.status_alterado',
          pedido_id: pedidoId,
        }),
      }).catch(() => {})

      fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'status', pedido_id: pedidoId, novo_status: novoStatus }),
      }).catch(() => {})
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
    const statusOrigem = active.data.current?.status as OrderStatus | undefined
    const destino = over.id as OrderStatus
    if (!destino || destino === statusOrigem) return
    if (destino === 'cancelado') {
      if (!hasRole('atendente')) {
        toast.error('Apenas atendentes ou superiores podem cancelar pedidos.')
        return
      }
      setConfirmCancelar(pedidoId)
      return
    }
    handleAvancarStatus(pedidoId, destino)
  }

  /* ── Computados ──────────────────────────────────── */

  const podeCancelarPorPapel = !roleLoading && hasRole('atendente')
  const podeNovoManual       = !roleLoading && hasRole('atendente')

  /* Pedidos filtrados por origem */
  const pedidosPorOrigem = filtroOrigem === 'todos'
    ? pedidos
    : pedidos.filter(p => (p.origem ?? 'delivery') === filtroOrigem)

  /* Cancelados — separados do kanban */
  const pedidosCancelados = pedidosPorOrigem.filter(p => p.status === 'cancelado')

  /* Kanban — sem cancelados */
  const pedidosKanban = pedidosPorOrigem.filter(p => p.status !== 'cancelado')

  /* Contadores para os tabs */
  const countDelivery   = pedidos.filter(p => (p.origem ?? 'delivery') === 'delivery' && p.status !== 'cancelado').length
  const countManual     = pedidos.filter(p => p.origem === 'manual' && p.status !== 'cancelado').length
  const countCancelados = pedidos.filter(p => p.status === 'cancelado').length

  /* KPIs do kanban */
  const faturamento = pedidosKanban.reduce((acc, p) => acc + p.total, 0)
  const kpis = {
    total: pedidosKanban.length,
    faturamento,
    ticketMedio: pedidosKanban.length > 0 ? faturamento / pedidosKanban.length : 0,
  }

  const pedidoDetalhe = detalheId ? pedidos.find(p => p.id === detalheId) ?? null : null

  /* ── Guard: sem loja ─────────────────────────────── */

  if (!roleLoading && !lojaId) {
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

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="flex flex-col min-h-0">

      {/* Header */}
      <OrdersHeader
        filtroData={filtroData}
        filtroOrigem={filtroOrigem}
        verCancelados={verCancelados}
        kpis={kpis}
        countDelivery={countDelivery}
        countManual={countManual}
        countCancelados={countCancelados}
        somAtivo={somAtivo}
        atualizando={atualizando}
        podeNovoManual={podeNovoManual}
        onFiltroData={setFiltroData}
        onFiltroOrigem={setFiltroOrigem}
        onVerCancelados={setVerCancelados}
        onAtivarSom={handleAtivarSom}
        onAtualizar={handleAtualizar}
        onNovoManual={() => setModalAberto(true)}
      />

      {/* Vista: Cancelados */}
      {verCancelados ? (
        <CancelledList
          pedidos={pedidosCancelados}
          onOpenDetail={id => setDetalheId(id)}
          onPrint={id => setImprimindoId(id)}
        />
      ) : (
        /* Vista: Kanban */
        carregando || roleLoading ? (
          <OrdersKanban
            pedidos={[]}
            itensPorPedido={{}}
            filtroOrigem={filtroOrigem}
            novosIds={new Set()}
            nomeLoja={nomeLoja}
            agora={agora}
            podeCancelar={false}
            atualizandoId={null}
            arrastandoId={null}
            detalheAberto={null}
            carregando
            onAdvance={() => {}}
            onCancel={() => {}}
            onOpenDetail={() => {}}
            onPrint={() => {}}
          />
        ) : pedidosKanban.length === 0 ? (
          <EmptyOrders />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={e => setArrastandoId(String(e.active.id))}
            onDragCancel={() => setArrastandoId(null)}
            onDragEnd={handleDragEnd}
          >
            <OrdersKanban
              pedidos={pedidosKanban}
              itensPorPedido={itensPorPedido}
              filtroOrigem={filtroOrigem}
              novosIds={novosIds}
              nomeLoja={nomeLoja}
              agora={agora}
              podeCancelar={podeCancelarPorPapel}
              atualizandoId={atualizandoStatus}
              arrastandoId={arrastandoId}
              detalheAberto={detalheId}
              carregando={false}
              onAdvance={handleAvancarStatus}
              onCancel={id => setConfirmCancelar(id)}
              onOpenDetail={id => setDetalheId(id)}
              onPrint={id => setImprimindoId(id)}
            />
          </DndContext>
        )
      )}

      {/* Sheet de detalhes */}
      <OrderDetailSheet
        pedido={pedidoDetalhe}
        itens={pedidoDetalhe ? itensPorPedido[pedidoDetalhe.id] : undefined}
        nomeLoja={nomeLoja}
        agora={agora}
        podeCancelar={podeCancelarPorPapel}
        isAdvancing={atualizandoStatus === detalheId}
        onClose={() => setDetalheId(null)}
        onAdvance={(id, status) => {
          handleAvancarStatus(id, status)
        }}
        onCancel={id => {
          setDetalheId(null)
          setConfirmCancelar(id)
        }}
      />

      {/* Diálogo de confirmação de cancelamento */}
      {confirmCancelar && (
        <ConfirmDialog
          titulo={`Cancelar pedido #${shortId(confirmCancelar)}?`}
          mensagem="Esta ação não pode ser desfeita. O cliente não será notificado automaticamente."
          labelConfirmar="Confirmar cancelamento"
          labelCancelar="Voltar"
          onConfirmar={handleConfirmarCancelar}
          onCancelar={() => setConfirmCancelar(null)}
        />
      )}

      {/* View de impressão (invisível na tela, visível só ao imprimir) */}
      {(() => {
        const p = imprimindoId ? pedidos.find(x => x.id === imprimindoId) ?? null : null
        return p ? (
          <OrderPrintView
            pedido={p}
            itens={itensPorPedido[p.id]}
            nomeLoja={nomeLoja}
          />
        ) : null
      })()}

      {/* Modal de novo pedido manual */}
      {modalAberto && lojaId && (
        <ModalPedidoManual
          lojaId={lojaId}
          onFechar={() => setModalAberto(false)}
          onCriado={() => lojaId && carregarPedidos(lojaId, filtroDataRef.current)}
        />
      )}
    </div>
  )
}
