import type { OrderStatus } from '@/components/ui/StatusBadge'

export type Origem = 'delivery' | 'manual'

export interface Pedido {
  id: string
  loja_id: string
  nome_cliente: string
  telefone_cliente: string
  endereco_entrega: string | null
  status: OrderStatus
  forma_pagamento: string
  troco_para: number | null
  subtotal: number
  taxa_entrega: number
  total: number
  observacoes: string | null
  criado_em: string
  origem: Origem
}

export interface ItemPedido {
  pedido_id: string
  nome_produto: string
  preco_unitario: number
  unidade: string
  quantidade: number
  subtotal: number
}

export function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function minutesAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

export function timeAgo(iso: string, now: number): string {
  const min = minutesAgo(iso, now)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `há ${h}h${String(m).padStart(2, '0')}` : `há ${h}h`
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function normalizePhone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export function isValidPhone(tel: string | null | undefined): boolean {
  if (!tel) return false
  return tel.replace(/\D/g, '').length >= 8
}

export interface NextStep {
  status: OrderStatus
  cta: string
}

export function nextStep(status: OrderStatus, origem: Origem): NextStep | null {
  switch (status) {
    case 'recebido':
      return { status: 'preparando', cta: 'Iniciar preparo' }
    case 'preparando':
      return origem === 'manual'
        ? { status: 'saiu_entrega', cta: 'Marcar como pronto' }
        : { status: 'saiu_entrega', cta: 'Despachar entrega' }
    case 'saiu_entrega':
      return origem === 'manual'
        ? { status: 'entregue', cta: 'Confirmar retirada' }
        : { status: 'entregue', cta: 'Confirmar entrega' }
    default:
      return null
  }
}

export function columnTitle(status: OrderStatus, filtroOrigem: 'todos' | 'delivery' | 'manual'): string {
  if (status !== 'saiu_entrega') {
    const labels: Record<OrderStatus, string> = {
      recebido: 'Recebido',
      preparando: 'Preparando',
      saiu_entrega: '',
      entregue: 'Entregue',
      cancelado: 'Cancelado',
    }
    return labels[status]
  }
  if (filtroOrigem === 'manual') return 'Pronto para retirada'
  if (filtroOrigem === 'delivery') return 'Saiu para entrega'
  return 'Saiu para entrega / Retirada'
}

export const PAYMENT_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_entrega: 'Cartão na entrega',
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const WA_MESSAGES: Record<OrderStatus, (nome: string, loja: string) => string> = {
  recebido: (n, l) =>
    `Olá ${n}! Recebemos seu pedido na ${l} e já estamos confirmando. Em breve começamos a preparar. Obrigado!`,
  preparando: (n, l) =>
    `Oi ${n}! Seu pedido na ${l} já está sendo preparado. Logo sai para entrega!`,
  saiu_entrega: (n, l) =>
    `${n}, seu pedido da ${l} saiu para entrega! Já está a caminho do seu endereço.`,
  entregue: (n, l) =>
    `Pedido entregue! Esperamos que você goste, ${n}. Obrigado por comprar na ${l}`,
  cancelado: (n, l) =>
    `Olá ${n}, seu pedido na ${l} foi cancelado. Qualquer dúvida, é só falar com a gente.`,
}

export function formatQty(qty: number, unit: string): string {
  if (unit === 'kg')
    return qty.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return String(qty)
}
