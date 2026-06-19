'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, XCircle, X } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'

/* ── Helpers ─────────────────────────────────────────── */

function primeiroDiaMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function chaveDispensa(): string {
  return `plan_banner_dismissed_${primeiroDiaMes()}`
}

/* ── Componente ──────────────────────────────────────── */

export function PlanLimitBanner() {
  const { usoMes, isNearLimit, isLimitReached } = usePlan()
  const { count, limite } = usoMes

  const [dispensado, setDispensado] = useState(false)
  const [visivel, setVisivel]       = useState(false)   // controla slide-down

  // Checa sessionStorage após montar (SSR-safe)
  useEffect(() => {
    if (sessionStorage.getItem(chaveDispensa())) {
      setDispensado(true)
    }
  }, [])

  // Dispara animação após primeira renderização
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisivel(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Sem limite → não renderiza ────────────────────────
  if (limite === null) return null

  const atingido = isLimitReached()
  const proximo  = isNearLimit() && !atingido

  if (!proximo && !atingido) return null
  if (proximo && dispensado)  return null

  function dispensar() {
    sessionStorage.setItem(chaveDispensa(), '1')
    setDispensado(true)
  }

  const base = [
    'flex items-start gap-3 rounded-xl px-4 py-3',
    'transition-all duration-200 ease-out',
    visivel ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
  ].join(' ')

  /* ── Banner vermelho: limite atingido ─────────────── */
  if (atingido) {
    return (
      <div className={`${base} bg-danger/10 border border-danger/30`} role="alert">
        <XCircle size={18} strokeWidth={1.75} className="text-danger shrink-0 mt-0.5" />

        <p className="flex-1 text-sm font-medium text-danger leading-snug">
          Limite atingido. Novos pedidos estão bloqueados até você fazer upgrade ou o mês virar.
        </p>

        <Link
          href="/painel/planos"
          className="shrink-0 inline-flex items-center min-h-[36px] px-3 rounded-md text-xs font-semibold bg-danger text-surface hover:bg-danger/90 active:scale-[0.98] transition-all duration-150 whitespace-nowrap"
        >
          Fazer upgrade →
        </Link>
      </div>
    )
  }

  /* ── Banner âmbar: próximo do limite ──────────────── */
  return (
    <div className={`${base} bg-accent/10 border border-accent/30`} role="alert">
      <AlertTriangle size={18} strokeWidth={1.75} className="text-accent shrink-0 mt-0.5" />

      <p className="flex-1 text-sm font-medium text-ink leading-snug">
        Atenção: você usou{' '}
        <strong className="text-accent">{count}</strong>
        {' '}de{' '}
        <strong className="text-accent">{limite}</strong>
        {' '}pedidos este mês.
      </p>

      <Link
        href="/painel/planos"
        className="shrink-0 text-xs font-semibold text-accent hover:underline transition-colors duration-150 whitespace-nowrap mt-0.5"
      >
        Fazer upgrade →
      </Link>

      <button
        onClick={dispensar}
        aria-label="Dispensar aviso"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-accent/15 text-ink-mute hover:text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  )
}
