'use client'

import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { Inbox } from 'lucide-react'
import { OrderCard } from './OrderCard'
import type { OrderStatus } from '@/components/ui/StatusBadge'
import { formatPrice, columnTitle, type ItemPedido, type Pedido } from '@/lib/pedidos/format'

/* ── Wrapper arrastável ─────────────────────────── */

function DraggableCard({ id, status, children }: { id: string; status: OrderStatus; children: React.ReactNode }) {
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

/* ── Mapa de cores da bolinha ───────────────────── */

const DOT_COLOR: Record<OrderStatus, string> = {
  recebido: 'bg-ink-mute',
  preparando: 'bg-accent',
  saiu_entrega: 'bg-brand-300',
  entregue: 'bg-brand-500',
  cancelado: 'bg-danger',
}

/* ── Coluna ─────────────────────────────────────── */

interface OrderColumnProps {
  status: OrderStatus
  filtroOrigem: 'todos' | 'delivery' | 'manual'
  pedidos: Pedido[]
  itensPorPedido: Record<string, ItemPedido[]>
  novosIds: Set<string>
  nomeLoja: string
  agora: number
  podeCancelar: boolean
  atualizandoId: string | null
  detalheAberto: string | null
  onAdvance: (id: string, status: OrderStatus) => void
  onCancel: (id: string) => void
  onOpenDetail: (id: string) => void
  onPrint: (id: string) => void
}

export function OrderColumn({
  status,
  filtroOrigem,
  pedidos,
  itensPorPedido,
  novosIds,
  nomeLoja,
  agora,
  podeCancelar,
  atualizandoId,
  onAdvance,
  onCancel,
  onOpenDetail,
  onPrint,
}: OrderColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  const titulo = columnTitle(status, filtroOrigem)
  const dotColor = DOT_COLOR[status]
  const faturamento = pedidos.reduce((acc, p) => acc + p.total, 0)

  return (
    <div className="min-w-[280px] max-w-[320px] w-[300px] shrink-0 flex flex-col gap-2 snap-start">
      {/* Cabeçalho da coluna */}
      <div className="px-0.5 pb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} aria-hidden="true" />
          <span className="text-sm font-semibold text-ink">{titulo}</span>
          <span className="ml-auto min-w-[20px] text-center text-xs font-medium text-ink-mute bg-line rounded-full px-2 py-0.5">
            {pedidos.length}
          </span>
        </div>
        {pedidos.length > 0 && (
          <p className="text-xs text-ink-mute mt-0.5 pl-4">{formatPrice(faturamento)}</p>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={[
          'flex flex-col gap-2 rounded-xl min-h-[64px] transition-colors duration-150',
          isOver ? 'ring-2 ring-brand-300 bg-brand-50/60 p-1' : '',
        ].join(' ')}
      >
        {pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox size={28} strokeWidth={1.25} className="text-line mb-2" />
            <p className="text-xs text-ink-mute">Nenhum pedido aqui</p>
          </div>
        ) : (
          pedidos.map(p => (
            <DraggableCard key={p.id} id={p.id} status={p.status}>
              <OrderCard
                pedido={p}
                itens={itensPorPedido[p.id]}
                isNovo={novosIds.has(p.id)}
                nomeLoja={nomeLoja}
                agora={agora}
                podeCancelar={podeCancelar}
                isAdvancing={atualizandoId === p.id}
                onAdvance={s => onAdvance(p.id, s)}
                onCancel={() => onCancel(p.id)}
                onOpenDetail={() => onOpenDetail(p.id)}
                onPrint={() => onPrint(p.id)}
              />
            </DraggableCard>
          ))
        )}
      </div>
    </div>
  )
}
