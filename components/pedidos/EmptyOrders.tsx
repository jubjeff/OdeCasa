import { Inbox } from 'lucide-react'

interface EmptyOrdersProps {
  message?: string
}

export function EmptyOrders({
  message = 'Nenhum pedido ainda hoje — assim que chegar, ele aparece aqui automaticamente.',
}: EmptyOrdersProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Inbox size={40} strokeWidth={1.25} className="text-ink-mute mb-3" />
      <p className="text-sm text-ink-mute leading-relaxed max-w-[260px]">{message}</p>
    </div>
  )
}
