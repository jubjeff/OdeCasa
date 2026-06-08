'use client'

import { useEffect } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  mensagem: string
  labelConfirmar?: string
  labelCancelar?: string
  onConfirmar: () => void
  onCancelar: () => void
}

export function ConfirmDialog({
  mensagem,
  labelConfirmar = 'Excluir',
  labelCancelar = 'Cancelar',
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  // Fecha com Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelar()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancelar])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop — clique fora cancela */}
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onCancelar}
      />

      {/* Card do diálogo */}
      <div className="animate-modal-in relative bg-surface rounded-xl shadow-lg w-full max-w-sm p-6 flex flex-col gap-5">
        <p className="text-base text-ink leading-relaxed">{mensagem}</p>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancelar}>
            {labelCancelar}
          </Button>
          <Button
            variant="secondary"
            className="text-danger border-danger/40 hover:bg-danger/10 active:bg-danger/20"
            onClick={onConfirmar}
            autoFocus
          >
            {labelConfirmar}
          </Button>
        </div>
      </div>
    </div>
  )
}
