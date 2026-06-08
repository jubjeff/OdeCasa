'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Loja, HorarioDia, Horarios } from './StoreInfoCard'

const DIAS_CONFIG = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]

const HORARIO_PADRAO: Horarios = {
  seg: { aberto: true,  abre: '08:00', fecha: '22:00' },
  ter: { aberto: true,  abre: '08:00', fecha: '22:00' },
  qua: { aberto: true,  abre: '08:00', fecha: '22:00' },
  qui: { aberto: true,  abre: '08:00', fecha: '22:00' },
  sex: { aberto: true,  abre: '08:00', fecha: '23:00' },
  sab: { aberto: true,  abre: '09:00', fecha: '23:00' },
  dom: { aberto: false, abre: '09:00', fecha: '18:00' },
}

interface OpeningHoursCardProps {
  loja: Loja
}

export function OpeningHoursCard({ loja }: OpeningHoursCardProps) {
  const [horarios, setHorarios] = useState<Horarios>(loja.horarios ?? HORARIO_PADRAO)
  const [salvando, setSalvando] = useState(false)

  function toggleDia(key: string) {
    setHorarios(prev => ({ ...prev, [key]: { ...prev[key], aberto: !prev[key].aberto } }))
  }

  function setHora(key: string, campo: 'abre' | 'fecha', valor: string) {
    setHorarios(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }))
  }

  async function handleSalvar() {
    setSalvando(true)
    const { error } = await supabase.from('lojas').update({ horarios }).eq('id', loja.id)
    setSalvando(false)
    if (error) toast.error('Erro ao salvar horários')
    else toast.success('Horários salvos')
  }

  return (
    <Card bodyClassName="p-6">
      <h2 className="text-[18px] font-semibold text-ink mb-5">Horário de funcionamento</h2>

      <div className="flex flex-col gap-3">
        {DIAS_CONFIG.map(({ key, label }) => {
          const dia: HorarioDia = horarios[key]
          return (
            <div key={key} className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => toggleDia(key)}
                aria-pressed={dia.aberto}
                aria-label={dia.aberto ? `Fechar ${label}` : `Abrir ${label}`}
                className={[
                  'flex items-center w-11 h-6 rounded-full p-1 transition-colors duration-200 shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  dia.aberto ? 'bg-brand-500' : 'bg-ink-mute/40',
                ].join(' ')}
              >
                <span className={[
                  'w-4 h-4 rounded-full bg-white shadow-sm shrink-0 transition-transform duration-200',
                  dia.aberto ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')} />
              </button>

              <span className="w-16 text-sm font-medium text-ink shrink-0">{label}</span>

              <input
                type="time"
                value={dia.abre}
                disabled={!dia.aberto}
                onChange={e => setHora(key, 'abre', e.target.value)}
                className={[
                  'h-9 rounded-md border border-line px-2 text-sm text-ink bg-surface',
                  'outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-opacity duration-150',
                  !dia.aberto ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}
              />

              <span className="text-sm text-ink-mute">às</span>

              <input
                type="time"
                value={dia.fecha}
                disabled={!dia.aberto}
                onChange={e => setHora(key, 'fecha', e.target.value)}
                className={[
                  'h-9 rounded-md border border-line px-2 text-sm text-ink bg-surface',
                  'outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-opacity duration-150',
                  !dia.aberto ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}
              />

              {!dia.aberto && (
                <span className="text-xs text-ink-mute">Fechado</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5">
        <Button onClick={handleSalvar} disabled={salvando} className="w-full sm:w-auto">
          {salvando ? 'Salvando...' : 'Salvar horários'}
        </Button>
      </div>
    </Card>
  )
}
