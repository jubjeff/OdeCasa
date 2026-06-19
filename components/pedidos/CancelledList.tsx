'use client'

import { Ban, Bike, MoreVertical, Printer, Store } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EmptyOrders } from './EmptyOrders'
import { formatDate, formatPrice, PAYMENT_LABEL, shortId, type Pedido } from '@/lib/pedidos/format'

interface CancelledListProps {
  pedidos: Pedido[]
  onOpenDetail: (id: string) => void
  onPrint: (id: string) => void
}

function RowMenu({ pedidoId, onDetail, onPrint }: {
  pedidoId: string
  onDetail: () => void
  onPrint: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const portalRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const inPortal  = portalRef.current?.contains(e.target as Node)
      const inTrigger = triggerRef.current?.contains(e.target as Node)
      if (!inPortal && !inTrigger) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
          }
          setOpen(v => !v)
        }}
        className="w-8 h-8 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Mais opções"
      >
        <MoreVertical size={15} strokeWidth={1.75} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          className="z-[9999] bg-surface rounded-xl shadow-lg border border-line py-1 min-w-[160px]"
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-brand-50 transition-colors duration-150"
            onClick={() => { setOpen(false); onDetail() }}
          >
            Ver detalhes
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-brand-50 transition-colors duration-150 flex items-center gap-2"
            onClick={() => { setOpen(false); onPrint() }}
          >
            <Printer size={13} strokeWidth={1.75} />
            Imprimir comanda
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

export function CancelledList({ pedidos, onOpenDetail, onPrint }: CancelledListProps) {
  if (pedidos.length === 0) {
    return <EmptyOrders message="Nenhum pedido cancelado neste período." />
  }

  return (
    <div className="px-4 py-5">
      <div className="flex flex-col gap-2 max-w-2xl">
        {pedidos.map(p => {
          const isManual = p.origem === 'manual'
          return (
            <div
              key={p.id}
              className="bg-surface rounded-xl shadow-sm border-l-4 border-l-danger opacity-70 hover:opacity-100 hover:shadow-md transition-all duration-150 flex items-center gap-2 pr-2"
            >
              {/* Área clicável principal */}
              <button
                type="button"
                onClick={() => onOpenDetail(p.id)}
                className="flex-1 min-w-0 text-left px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset rounded-l-xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-ink-mute shrink-0">#{shortId(p.id)}</span>
                    <span className="flex items-center gap-1 text-ink-mute shrink-0">
                      {isManual
                        ? <Store size={12} strokeWidth={1.75} />
                        : <Bike size={12} strokeWidth={1.75} />
                      }
                      <span className="text-[10px] font-medium">{isManual ? 'Balcão' : 'Delivery'}</span>
                    </span>
                    <p className="text-sm font-semibold text-ink truncate line-through">
                      {p.nome_cliente || (isManual ? 'Cliente do balcão' : '—')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-ink-mute line-through hidden sm:block">
                      {formatPrice(p.total)}
                    </span>
                    <span className="text-xs text-ink-mute hidden md:block">{formatDate(p.criado_em)}</span>
                    <span className="flex items-center gap-1 text-xs text-danger bg-danger/10 rounded-full px-2 py-0.5 font-medium">
                      <Ban size={11} strokeWidth={2} />
                      Cancelado
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-1 text-xs text-ink-mute">
                  <span className="sm:hidden font-bold text-ink-mute line-through">{formatPrice(p.total)}</span>
                  <span>{PAYMENT_LABEL[p.forma_pagamento] ?? p.forma_pagamento}</span>
                  <span className="md:hidden">{formatDate(p.criado_em)}</span>
                </div>
              </button>

              {/* Menu ⋯ */}
              <RowMenu
                pedidoId={p.id}
                onDetail={() => onOpenDetail(p.id)}
                onPrint={() => onPrint(p.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
