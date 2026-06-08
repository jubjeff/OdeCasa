'use client'

import { useState } from 'react'
import { MapPin, Navigation, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import type { Loja, FaixaEntrega } from './StoreInfoCard'

interface DistanceDeliveryCardProps {
  loja: Loja
}

export function DistanceDeliveryCard({ loja }: DistanceDeliveryCardProps) {
  const jaConfigurado = loja.faixas_entrega != null && loja.faixas_entrega.length > 0
  const [ativo, setAtivo]         = useState(jaConfigurado)
  const [latitude, setLatitude]   = useState<number | null>(loja.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(loja.longitude ?? null)
  const [raio, setRaio]           = useState(String(loja.raio_maximo_km ?? 10))
  const [faixas, setFaixas]       = useState<FaixaEntrega[]>(loja.faixas_entrega ?? [])
  const [detectando, setDetectando] = useState(false)
  const [salvando, setSalvando]     = useState(false)

  function detectarLocalizacao() {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada neste navegador')
      return
    }
    setDetectando(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
        setDetectando(false)
        toast.success('Localização detectada — clique em Salvar para confirmar')
      },
      () => {
        setDetectando(false)
        toast.error('Não foi possível obter a localização. Verifique as permissões do navegador.')
      }
    )
  }

  function adicionarFaixa() {
    if (faixas.length >= 5) return
    const ultima = faixas[faixas.length - 1]
    const proxDist = ultima ? ultima.distancia_ate + 1 : 1
    setFaixas(prev => [...prev, { distancia_ate: proxDist, taxa: 0 }])
  }

  function removerFaixa(idx: number) {
    setFaixas(prev => prev.filter((_, i) => i !== idx))
  }

  function setFaixaCampo(idx: number, campo: keyof FaixaEntrega, valor: string) {
    setFaixas(prev => prev.map((f, i) =>
      i === idx ? { ...f, [campo]: parseFloat(valor.replace(',', '.')) || 0 } : f
    ))
  }

  async function handleSalvar() {
    setSalvando(true)

    if (!ativo) {
      const { error } = await supabase.from('lojas').update({
        latitude: null, longitude: null, raio_maximo_km: null, faixas_entrega: null,
      }).eq('id', loja.id)
      setSalvando(false)
      if (error) toast.error(`Erro ao salvar: ${error.message}`)
      else toast.success('Entrega por distância desativada')
      return
    }

    const raioNum = parseFloat(raio) || 10
    const faixasOrdenadas = [...faixas]
      .sort((a, b) => a.distancia_ate - b.distancia_ate)
      .filter(f => f.distancia_ate > 0 && f.distancia_ate <= raioNum)

    if (faixasOrdenadas.length > 0) {
      faixasOrdenadas[faixasOrdenadas.length - 1].distancia_ate = raioNum
    }

    const { error } = await supabase.from('lojas').update({
      latitude,
      longitude,
      raio_maximo_km: raioNum,
      faixas_entrega: faixasOrdenadas.length > 0 ? faixasOrdenadas : null,
    }).eq('id', loja.id)
    setSalvando(false)

    if (error) toast.error(`Erro ao salvar: ${error.message}`)
    else {
      setFaixas(faixasOrdenadas)
      toast.success('Área de entrega salva')
    }
  }

  const raioNum = parseFloat(raio) || 10

  return (
    <Card bodyClassName="p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">Entrega por distância</h2>
          <p className="text-xs text-ink-mute mt-0.5">Opcional — em breve com suporte ao Google Maps</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ativo}
          onClick={() => setAtivo(v => !v)}
          className={[
            'relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 mt-0.5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
            ativo ? 'bg-brand-500' : 'bg-line',
          ].join(' ')}
        >
          <span className={[
            'absolute top-0.5 left-0.5 w-5 h-5 bg-surface rounded-full shadow-sm transition-transform duration-200',
            ativo ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')} />
        </button>
      </div>

      {!ativo ? (
        <div className="mt-4 rounded-lg bg-bg border border-line px-4 py-3">
          <p className="text-sm text-ink-soft leading-relaxed">
            Quando desativado, todos os clientes pagam a{' '}
            <span className="font-medium text-ink">taxa de entrega fixa</span> configurada nos dados da loja.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mt-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">Localização da loja</span>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto !min-h-[44px] gap-2"
              onClick={detectarLocalizacao}
              disabled={detectando}
            >
              <Navigation size={16} strokeWidth={1.75} />
              {detectando ? 'Detectando…' : 'Detectar minha localização'}
            </Button>
            {latitude != null && longitude != null ? (
              <p className="flex items-center gap-1.5 text-sm text-brand-600 font-medium">
                <MapPin size={14} strokeWidth={1.75} />
                Localização salva ({latitude.toFixed(5)}, {longitude.toFixed(5)})
              </p>
            ) : (
              <p className="text-sm text-ink-mute">Localização não configurada — clique em detectar acima</p>
            )}
          </div>

          <Input
            label="Raio máximo de entrega"
            id="raio_maximo_km"
            type="number"
            min="1"
            step="0.5"
            suffix="km"
            value={raio}
            onChange={e => setRaio(e.target.value)}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">Faixas de entrega</span>

            {faixas.length === 0 && (
              <p className="text-sm text-ink-mute">
                Nenhuma faixa adicionada — será usada a taxa fixa da loja.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {faixas.map((faixa, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-ink-soft shrink-0">Até</span>
                  <div className="w-20">
                    <input
                      type="number"
                      min="0.5"
                      max={raioNum}
                      step="0.5"
                      value={faixa.distancia_ate}
                      onChange={e => setFaixaCampo(idx, 'distancia_ate', e.target.value)}
                      className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <span className="text-sm text-ink-soft shrink-0">km → Taxa</span>
                  <div className="w-28">
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={faixa.taxa}
                      onChange={e => setFaixaCampo(idx, 'taxa', e.target.value)}
                      className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <span className="text-sm text-ink-soft shrink-0">R$</span>
                  <button
                    type="button"
                    onClick={() => removerFaixa(idx)}
                    aria-label="Remover faixa"
                    className="w-9 h-9 flex items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>

            {faixas.length < 5 && (
              <button
                type="button"
                onClick={adicionarFaixa}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors duration-150 w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
              >
                <Plus size={15} strokeWidth={2} />
                Adicionar faixa
              </button>
            )}

            {faixas.length > 0 && (
              <p className="text-xs text-ink-mute leading-relaxed">
                A última faixa será ajustada para {raioNum} km ao salvar. Faixas com distância maior que o raio são ignoradas.
              </p>
            )}
          </div>

          <Button onClick={handleSalvar} disabled={salvando} className="w-full sm:w-auto">
            {salvando ? 'Salvando…' : 'Salvar área de entrega'}
          </Button>
        </div>
      )}

      {!ativo && jaConfigurado && (
        <div className="mt-4">
          <Button onClick={handleSalvar} disabled={salvando} variant="secondary" className="w-full sm:w-auto">
            {salvando ? 'Salvando…' : 'Confirmar desativação'}
          </Button>
        </div>
      )}
    </Card>
  )
}
