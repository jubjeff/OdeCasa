export type OrderStatus =
  | 'recebido'
  | 'preparando'
  | 'saiu_entrega'
  | 'entregue'
  | 'cancelado'

interface Config {
  label: string
  className: string
}

const STATUS_CONFIG: Record<OrderStatus, Config> = {
  recebido: {
    label: 'Recebido',
    className: 'bg-line text-ink-soft',
  },
  preparando: {
    label: 'Preparando',
    className: 'bg-accent/15 text-accent',
  },
  saiu_entrega: {
    label: 'Saiu p/ entrega',
    className: 'bg-brand-100 text-brand-700',
  },
  entregue: {
    label: 'Entregue',
    className: 'bg-brand-500 text-surface',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-danger/15 text-danger',
  },
}

interface StatusBadgeProps {
  status: OrderStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status]
  return (
    <span
      className={[
        'inline-flex items-center px-3 py-1',
        'rounded-full text-sm font-medium',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  )
}
