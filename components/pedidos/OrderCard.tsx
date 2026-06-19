'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Ban, Bike, MapPin, MessageCircle, MoreVertical, Printer, Store } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { OrderStatus } from '@/components/ui/StatusBadge'
import {
  formatPrice,
  isValidPhone,
  minutesAgo,
  nextStep,
  normalizePhone,
  shortId,
  timeAgo,
  WA_MESSAGES,
  type ItemPedido,
  type Pedido,
} from '@/lib/pedidos/format'

interface OrderCardProps {
  pedido: Pedido
  itens?: ItemPedido[]
  isNovo: boolean
  nomeLoja: string
  agora: number
  podeCancelar: boolean
  isAdvancing: boolean
  onAdvance: (newStatus: OrderStatus) => void
  onCancel: () => void
  onOpenDetail: () => void
  onPrint: () => void
}

export function OrderCard({
  pedido,
  itens,
  isNovo,
  nomeLoja,
  agora,
  podeCancelar,
  isAdvancing,
  onAdvance,
  onCancel,
  onOpenDetail,
  onPrint,
}: OrderCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const portalRef   = useRef<HTMLDivElement>(null)
  const triggerRef  = useRef<HTMLButtonElement>(null)

  const isManual = pedido.origem === 'manual'
  const isCancelled = pedido.status === 'cancelado'
  const isDone = pedido.status === 'entregue' || isCancelled
  const next = nextStep(pedido.status, pedido.origem)

  const minAgo = minutesAgo(pedido.criado_em, agora)
  const timeStr = timeAgo(pedido.criado_em, agora)
  const timeColor = minAgo > 240 ? 'text-danger' : minAgo > 120 ? 'text-accent' : 'text-ink-mute'

  const firstItem = itens?.[0]
  const extraItems = itens ? Math.max(0, itens.length - 1) : 0

  const hasPhone = isValidPhone(pedido.telefone_cliente)
  const waMsg = WA_MESSAGES[pedido.status](pedido.nome_cliente || 'cliente', nomeLoja || 'nossa loja')
  const waLink = hasPhone
    ? `https://wa.me/${normalizePhone(pedido.telefone_cliente)}?text=${encodeURIComponent(waMsg)}`
    : undefined

  const showAddress = !isManual && pedido.endereco_entrega
  const delayRing = minAgo > 120 && !isDone ? 'ring-2 ring-accent/40' : ''

  useEffect(() => {
    if (!dropdownOpen) return
    function handle(e: MouseEvent) {
      const inTrigger = dropdownRef.current?.contains(e.target as Node)
      const inPortal  = portalRef.current?.contains(e.target as Node)
      if (!inTrigger && !inPortal) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [dropdownOpen])

  return (
    <div
      className={[
        'relative bg-surface rounded-xl shadow-sm overflow-hidden',
        'transition-all duration-150',
        'hover:shadow-md hover:-translate-y-px',
        delayRing,
        isCancelled ? 'opacity-60' : '',
        isNovo ? 'animate-card-entry' : '',
      ].join(' ')}
    >
      {/* Fita lateral colorida */}
      <div
        className={[
          'absolute inset-y-0 left-0 w-1',
          isManual ? 'bg-accent' : 'bg-brand-500',
          isNovo ? 'animate-border-pulse' : '',
        ].join(' ')}
      />

      {/* Área clicável do body */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="w-full text-left pl-4 pr-3 pt-3 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        {/* Linha: ID + tipo + badge Novo */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className={`font-mono text-xs text-ink-mute ${isCancelled ? 'line-through' : ''}`}>
            #{shortId(pedido.id)}
          </span>
          <div className="flex items-center gap-1.5">
            {isNovo && (
              <span className="text-[10px] font-bold text-surface bg-danger rounded-full px-2 py-0.5 leading-none">
                Novo
              </span>
            )}
            <div className="flex items-center gap-1 text-ink-mute">
              {isManual
                ? <Store size={12} strokeWidth={1.75} />
                : <Bike size={12} strokeWidth={1.75} />
              }
              <span className="text-[10px] font-medium">{isManual ? 'Balcão' : 'Delivery'}</span>
            </div>
          </div>
        </div>

        {/* Tempo + total */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className={`text-xs ${timeColor}`}>{timeStr}</span>
          <span className="text-[15px] font-bold text-brand-500">{formatPrice(pedido.total)}</span>
        </div>

        {/* Nome do cliente */}
        <p className={`text-sm font-semibold text-ink leading-tight mb-1 ${isCancelled ? 'line-through' : ''}`}>
          {pedido.nome_cliente || (isManual ? 'Cliente do balcão' : '—')}
        </p>

        {/* Endereço (só delivery) */}
        {showAddress && (
          <p className="flex items-center gap-1 text-xs text-ink-mute mb-1">
            <MapPin size={11} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{pedido.endereco_entrega}</span>
          </p>
        )}

        {/* Primeiro item */}
        {firstItem && (
          <p className="text-xs text-ink-soft truncate">
            {firstItem.quantidade}× {firstItem.nome_produto}
            {extraItems > 0 && (
              <span className="text-ink-mute"> +{extraItems} iten{extraItems > 1 ? 's' : ''}</span>
            )}
          </p>
        )}
      </button>

      {/* Rodapé: CTA + menu */}
      <div className="flex items-center gap-1.5 pl-4 pr-3 pb-3 pt-1">
        {next && !isDone && (
          <Button
            variant="primary"
            onClick={(e) => { e.stopPropagation(); onAdvance(next.status) }}
            disabled={isAdvancing}
            className="flex-1 !min-h-[36px] text-xs px-3 gap-1"
          >
            {next.cta}
            <ArrowRight size={13} strokeWidth={2} />
          </Button>
        )}

        {/* Menu ⋯ */}
        <div ref={dropdownRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!dropdownOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect()
                setDropdownPos({
                  top: rect.top,
                  right: window.innerWidth - rect.right,
                })
              }
              setDropdownOpen(v => !v)
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Mais opções"
          >
            <MoreVertical size={16} strokeWidth={1.75} />
          </button>

          {dropdownOpen && typeof document !== 'undefined' && createPortal(
            <div
              ref={portalRef}
              style={{
                position: 'fixed',
                top: dropdownPos.top,
                right: dropdownPos.right,
                transform: 'translateY(-100%)',
                marginBottom: '4px',
              }}
              className="z-[9999] bg-surface rounded-xl shadow-lg border border-line py-1 min-w-[180px]"
            >
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-brand-50 transition-colors duration-150"
                onClick={() => { setDropdownOpen(false); onOpenDetail() }}
              >
                Ver detalhes
              </button>

              {hasPhone ? (
                <a
                  href={waLink!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-brand-50 transition-colors duration-150"
                  onClick={() => setDropdownOpen(false)}
                >
                  <MessageCircle size={14} strokeWidth={1.75} />
                  Enviar mensagem
                </a>
              ) : isManual ? (
                <span
                  title="Pedido sem telefone cadastrado"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-mute cursor-not-allowed select-none"
                >
                  <MessageCircle size={14} strokeWidth={1.75} />
                  Enviar mensagem
                </span>
              ) : null}

              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-brand-50 transition-colors duration-150 flex items-center gap-2"
                onClick={() => { setDropdownOpen(false); onPrint() }}
              >
                <Printer size={14} strokeWidth={1.75} />
                Imprimir comanda
              </button>

              {podeCancelar && !isDone && (
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors duration-150 flex items-center gap-2"
                  onClick={() => { setDropdownOpen(false); onCancel() }}
                >
                  <Ban size={14} strokeWidth={1.75} />
                  Cancelar pedido
                </button>
              )}
            </div>,
            document.body,
          )}
        </div>
      </div>
    </div>
  )
}
