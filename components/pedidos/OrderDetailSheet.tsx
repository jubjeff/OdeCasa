'use client'

import { useEffect } from 'react'
import { ArrowRight, Ban, ExternalLink, MapPin, MessageCircle, Phone, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Bike, Store } from 'lucide-react'
import type { OrderStatus } from '@/components/ui/StatusBadge'
import {
  formatDate,
  formatPrice,
  formatQty,
  isValidPhone,
  nextStep,
  normalizePhone,
  PAYMENT_LABEL,
  shortId,
  STATUS_LABEL,
  WA_MESSAGES,
  type ItemPedido,
  type Pedido,
} from '@/lib/pedidos/format'

const STATUS_ORDER: OrderStatus[] = ['recebido', 'preparando', 'saiu_entrega', 'entregue']

const STATUS_DOT: Record<OrderStatus, string> = {
  recebido: 'bg-ink-mute',
  preparando: 'bg-accent',
  saiu_entrega: 'bg-brand-300',
  entregue: 'bg-brand-500',
  cancelado: 'bg-danger',
}

interface OrderDetailSheetProps {
  pedido: Pedido | null
  itens: ItemPedido[] | undefined
  nomeLoja: string
  agora: number
  podeCancelar: boolean
  isAdvancing: boolean
  onClose: () => void
  onAdvance: (id: string, status: OrderStatus) => void
  onCancel: (id: string) => void
}

export function OrderDetailSheet({
  pedido,
  itens,
  nomeLoja,
  agora: _agora,
  podeCancelar,
  isAdvancing,
  onClose,
  onAdvance,
  onCancel,
}: OrderDetailSheetProps) {
  // Fechar com Escape
  useEffect(() => {
    if (!pedido) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [pedido, onClose])

  // Trava scroll do body
  useEffect(() => {
    if (pedido) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [pedido])

  if (!pedido) return null

  const isManual = pedido.origem === 'manual'
  const isCancelled = pedido.status === 'cancelado'
  const isDone = pedido.status === 'entregue' || isCancelled
  const next = nextStep(pedido.status, pedido.origem)

  const hasPhone = isValidPhone(pedido.telefone_cliente)
  const waMsg = WA_MESSAGES[pedido.status](pedido.nome_cliente || 'cliente', nomeLoja)
  const waLink = hasPhone
    ? `https://wa.me/${normalizePhone(pedido.telefone_cliente)}?text=${encodeURIComponent(waMsg)}`
    : undefined

  const activeIdx = pedido.status === 'cancelado'
    ? -1
    : STATUS_ORDER.indexOf(pedido.status)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel lateral */}
      <div
        role="dialog"
        aria-label="Detalhes do pedido"
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[480px] bg-surface shadow-lg animate-sheet-in"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-ink-mute">#{shortId(pedido.id)}</span>
              <span className={[
                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                isManual ? 'bg-accent/10 text-accent' : 'bg-brand-100 text-brand-700',
              ].join(' ')}>
                {isManual ? <Store size={11} strokeWidth={1.75} /> : <Bike size={11} strokeWidth={1.75} />}
                {isManual ? 'Balcão' : 'Delivery'}
              </span>
              {isCancelled && (
                <span className="text-xs font-medium text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                  Cancelado
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-brand-700">{formatPrice(pedido.total)}</p>
            <p className="text-xs text-ink-mute mt-0.5">{formatDate(pedido.criado_em)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Timeline de status */}
          {!isCancelled ? (
            <div>
              <p className="text-xs font-semibold text-ink-soft mb-3">Progresso</p>
              <div className="flex flex-col gap-0">
                {STATUS_ORDER.map((s, idx) => {
                  const isPast = idx < activeIdx
                  const isCurrent = idx === activeIdx
                  const isFuture = idx > activeIdx
                  return (
                    <div key={s} className="flex items-start gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={[
                          'w-3 h-3 rounded-full mt-0.5 transition-colors',
                          isCurrent ? `${STATUS_DOT[s]} ring-2 ring-offset-2 ring-brand-300` : '',
                          isPast ? 'bg-brand-500' : '',
                          isFuture ? 'bg-line' : '',
                        ].join(' ')} />
                        {idx < STATUS_ORDER.length - 1 && (
                          <div className={`w-px flex-1 my-1 ${isPast ? 'bg-brand-300' : 'bg-line'}`} style={{ height: '20px' }} />
                        )}
                      </div>
                      <p className={[
                        'text-sm pb-4',
                        isCurrent ? 'font-semibold text-ink' : '',
                        isPast ? 'text-ink-soft' : '',
                        isFuture ? 'text-ink-mute' : '',
                      ].join(' ')}>
                        {s === 'saiu_entrega'
                          ? (isManual ? 'Pronto para retirada' : 'Saiu para entrega')
                          : STATUS_LABEL[s]
                        }
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/5 text-danger text-sm font-medium">
              Pedido cancelado
            </div>
          )}

          {/* Bloco: Cliente */}
          <div className="rounded-xl border border-line p-4 space-y-2.5">
            <p className="text-xs font-semibold text-ink-soft">Cliente</p>
            <p className="text-sm font-semibold text-ink">
              {pedido.nome_cliente || (isManual ? 'Cliente do balcão' : '—')}
            </p>

            {hasPhone && (
              <div className="flex items-center gap-2">
                <Phone size={13} strokeWidth={1.75} className="text-ink-mute shrink-0" />
                <span className="text-sm text-ink-soft">{pedido.telefone_cliente}</span>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors duration-150"
                  >
                    <MessageCircle size={13} strokeWidth={1.75} />
                    WhatsApp
                  </a>
                )}
              </div>
            )}

            {!isManual && pedido.endereco_entrega && (
              <div className="flex items-start gap-2">
                <MapPin size={13} strokeWidth={1.75} className="text-ink-mute shrink-0 mt-0.5" />
                <span className="text-sm text-ink-soft leading-snug flex-1">
                  {pedido.endereco_entrega}
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.endereco_entrega)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors duration-150"
                >
                  <ExternalLink size={12} strokeWidth={1.75} />
                  Ver mapa
                </a>
              </div>
            )}
          </div>

          {/* Bloco: Itens */}
          {itens && itens.length > 0 && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold text-ink-soft mb-3">Itens</p>
              <div className="space-y-2">
                {itens.map((item, i) => (
                  <div key={i} className="flex justify-between items-baseline gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-ink">{item.nome_produto}</span>
                      <span className="text-xs text-ink-mute ml-1">
                        × {formatQty(item.quantidade, item.unidade)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-ink shrink-0">
                      {formatPrice(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-line mt-3 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-ink-soft">
                  <span>Subtotal</span>
                  <span>{formatPrice(pedido.subtotal)}</span>
                </div>
                {!isManual && (
                  <div className="flex justify-between text-xs text-ink-soft">
                    <span>Taxa de entrega</span>
                    <span className={pedido.taxa_entrega === 0 ? 'text-brand-600 font-medium' : ''}>
                      {pedido.taxa_entrega === 0 ? 'Grátis' : formatPrice(pedido.taxa_entrega)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-ink pt-1">
                  <span>Total</span>
                  <span>{formatPrice(pedido.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bloco: Pagamento */}
          <div className="rounded-xl border border-line p-4 space-y-2">
            <p className="text-xs font-semibold text-ink-soft">Pagamento</p>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Forma</span>
              <span className="text-ink font-medium">
                {PAYMENT_LABEL[pedido.forma_pagamento] ?? pedido.forma_pagamento}
              </span>
            </div>
            {pedido.troco_para != null && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Troco para</span>
                <span className="text-ink font-medium">{formatPrice(pedido.troco_para)}</span>
              </div>
            )}
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold text-ink-soft mb-1">Observações</p>
              <p className="text-sm text-ink-soft leading-relaxed">{pedido.observacoes}</p>
            </div>
          )}
        </div>

        {/* Footer fixo */}
        {!isDone && next && (
          <div className="flex gap-2 px-5 py-4 border-t border-line bg-surface shrink-0">
            <Button
              variant="primary"
              onClick={() => onAdvance(pedido.id, next.status)}
              disabled={isAdvancing}
              className="flex-1 gap-2"
            >
              {next.cta}
              <ArrowRight size={16} strokeWidth={2} />
            </Button>
            {podeCancelar && (
              <Button
                variant="secondary"
                onClick={() => onCancel(pedido.id)}
                className="!px-3 text-danger border-danger/30 hover:bg-danger/5"
              >
                <Ban size={16} strokeWidth={1.75} />
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
