'use client'

import { DragOverlay } from '@dnd-kit/core'
import { Bike, Store } from 'lucide-react'
import { OrderColumn } from './OrderColumn'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { OrderStatus } from '@/components/ui/StatusBadge'
import { formatPrice, shortId, type ItemPedido, type Pedido } from '@/lib/pedidos/format'

type FiltroOrigem = 'todos' | 'delivery' | 'manual'

const COLUNAS: { status: OrderStatus }[] = [
  { status: 'recebido' },
  { status: 'preparando' },
  { status: 'saiu_entrega' },
  { status: 'entregue' },
]

interface OrdersKanbanProps {
  pedidos: Pedido[]
  itensPorPedido: Record<string, ItemPedido[]>
  filtroOrigem: FiltroOrigem
  novosIds: Set<string>
  nomeLoja: string
  agora: number
  podeCancelar: boolean
  atualizandoId: string | null
  arrastandoId: string | null
  detalheAberto: string | null
  carregando: boolean
  onAdvance: (id: string, status: OrderStatus) => void
  onCancel: (id: string) => void
  onOpenDetail: (id: string) => void
  onPrint: (id: string) => void
}

export function OrdersKanban({
  pedidos,
  itensPorPedido,
  filtroOrigem,
  novosIds,
  nomeLoja,
  agora,
  podeCancelar,
  atualizandoId,
  arrastandoId,
  detalheAberto,
  carregando,
  onAdvance,
  onCancel,
  onOpenDetail,
  onPrint,
}: OrdersKanbanProps) {
  const pedidoArrastado = arrastandoId ? pedidos.find(p => p.id === arrastandoId) : null

  if (carregando) {
    return (
      <div className="flex gap-4 px-4 py-5 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, c) => (
          <div key={c} className="min-w-[280px] w-[300px] shrink-0 flex flex-col gap-2">
            <Skeleton className="h-5 w-32 mb-1" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-xl shadow-sm p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-full mt-2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex gap-4 px-4 py-5 pb-10 min-w-max snap-x snap-mandatory">
          {COLUNAS.map(col => (
            <OrderColumn
              key={col.status}
              status={col.status}
              filtroOrigem={filtroOrigem}
              pedidos={pedidos.filter(p => p.status === col.status)}
              itensPorPedido={itensPorPedido}
              novosIds={novosIds}
              nomeLoja={nomeLoja}
              agora={agora}
              podeCancelar={podeCancelar}
              atualizandoId={atualizandoId}
              detalheAberto={detalheAberto}
              onAdvance={onAdvance}
              onCancel={onCancel}
              onOpenDetail={onOpenDetail}
              onPrint={onPrint}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {pedidoArrastado ? (
          <div className="w-[300px] bg-surface rounded-xl shadow-lg ring-2 ring-brand-300 p-4 rotate-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono text-xs text-ink-mute">#{shortId(pedidoArrastado.id)}</span>
              <div className="flex items-center gap-1 text-ink-mute">
                {pedidoArrastado.origem === 'manual'
                  ? <Store size={12} strokeWidth={1.75} />
                  : <Bike size={12} strokeWidth={1.75} />
                }
              </div>
            </div>
            <p className="text-sm font-semibold text-ink truncate mb-1">
              {pedidoArrastado.nome_cliente || 'Cliente do balcão'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={pedidoArrastado.status} />
              <span className="text-[15px] font-bold text-brand-700">{formatPrice(pedidoArrastado.total)}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </>
  )
}
