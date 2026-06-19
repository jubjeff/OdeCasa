'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'
import { UpgradeSheet } from '@/components/UpgradeSheet'

interface PlanGateProps {
  feature: string
  fallback?: string
  /** 'block' (padrão): overlay sobre preview. 'compact': chip inline discreto. */
  variant?: 'block' | 'compact'
  children: React.ReactNode
}

export function PlanGate({ feature, fallback, variant = 'block', children }: PlanGateProps) {
  const { hasFeature, isLoading } = usePlan()
  const [showSheet, setShowSheet] = useState(false)

  // ── Carregando: renderiza sem overlay para evitar flash ──
  if (isLoading) return <>{children}</>

  // ── Liberado: sem wrapper extra ──────────────────────
  if (hasFeature(feature)) return <>{children}</>

  // ── Bloqueado compact: chip inline clicável ───────────
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setShowSheet(true)}
          title="Fazer upgrade para desbloquear"
          className={[
            'inline-flex items-center gap-1.5 whitespace-nowrap',
            'min-h-[36px] px-3 rounded-full',
            'text-sm font-medium text-ink-mute',
            'border border-dashed border-line bg-surface',
            'hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200',
            'transition-colors duration-150 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          ].join(' ')}
        >
          <Lock size={13} strokeWidth={1.75} className="shrink-0 text-brand-400" />
          {fallback ?? 'Recurso bloqueado'}
        </button>
        <UpgradeSheet feature={feature} open={showSheet} onClose={() => setShowSheet(false)} />
      </>
    )
  }

  // ── Bloqueado block: overlay sobre preview ────────────
  return (
    <>
      <div className="relative">
        {/* Preview opacificado — não-interativo */}
        <div
          className="select-none pointer-events-none"
          style={{ opacity: 0.4 }}
          aria-hidden="true"
        >
          {children}
        </div>

        {/* Overlay */}
        <div
          className={[
            'absolute inset-0 rounded-xl',
            'flex flex-col items-center justify-center gap-3',
            'min-h-[120px] px-6 py-5',
          ].join(' ')}
          style={{
            background: 'rgba(250, 250, 247, 0.82)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          {/* Ícone */}
          <div className="w-11 h-11 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
            <Lock size={20} strokeWidth={1.75} className="text-brand-500" />
          </div>

          {/* Texto */}
          <p className="text-sm font-medium text-ink text-center leading-snug max-w-[220px]">
            {fallback ?? 'Este recurso requer um plano superior'}
          </p>

          {/* CTA — abre o Sheet */}
          <button
            onClick={() => setShowSheet(true)}
            className={[
              'inline-flex items-center justify-center gap-1.5',
              'min-h-[40px] px-4 rounded-md',
              'bg-brand-500 text-surface text-sm font-semibold',
              'hover:bg-brand-600 active:scale-[0.98]',
              'transition-all duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            ].join(' ')}
          >
            Ver planos →
          </button>
        </div>
      </div>

      <UpgradeSheet
        feature={feature}
        open={showSheet}
        onClose={() => setShowSheet(false)}
      />
    </>
  )
}
