'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Plus, Pencil, Trash2, Star, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

/* ── Tipos ───────────────────────────────────────── */

interface Cliente {
  id: string
  nome: string
  email: string
}

interface Endereco {
  id: string
  cliente_id: string
  apelido: string | null
  endereco: string
  complemento: string | null
  referencia: string | null
  padrao: boolean
  criado_em: string
}

interface FormEndereco {
  apelido: string
  endereco: string
  complemento: string
  referencia: string
}

const FORM_VAZIO: FormEndereco = {
  apelido: '',
  endereco: '',
  complemento: '',
  referencia: '',
}

/* ── Formulário de endereço (adicionar/editar) ───── */

interface EnderecoFormProps {
  inicial: FormEndereco
  salvando: boolean
  onSalvar: (valores: FormEndereco) => void
  onCancelar: () => void
}

function EnderecoForm({ inicial, salvando, onSalvar, onCancelar }: EnderecoFormProps) {
  const [form, setForm] = useState<FormEndereco>(inicial)
  const [erro, setErro] = useState<string | null>(null)

  function set(campo: keyof FormEndereco, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (erro) setErro(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.endereco.trim()) {
      setErro('Informe o endereço')
      return
    }
    onSalvar(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl px-4 py-4 shadow-sm space-y-4">
      <Input
        id="apelido"
        label="Apelido (opcional)"
        placeholder="Casa, Trabalho..."
        value={form.apelido}
        onChange={e => set('apelido', e.target.value)}
      />
      <div>
        <Input
          id="endereco"
          label="Endereço"
          placeholder="Rua, número, bairro"
          value={form.endereco}
          onChange={e => set('endereco', e.target.value)}
          autoComplete="street-address"
        />
        {erro && <p className="text-xs text-danger mt-1">{erro}</p>}
      </div>
      <Input
        id="complemento"
        label="Complemento (opcional)"
        placeholder="Apto, bloco, casa..."
        value={form.complemento}
        onChange={e => set('complemento', e.target.value)}
      />
      <Input
        id="referencia"
        label="Ponto de referência (opcional)"
        placeholder="Próximo a..."
        value={form.referencia}
        onChange={e => set('referencia', e.target.value)}
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={salvando} className="flex-1">
          {salvando ? 'Salvando...' : 'Salvar endereço'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function ContaCliente() {
  const router = useRouter()

  const [cliente, setCliente]   = useState<Cliente | null | undefined>(undefined)
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [editando, setEditando] = useState<string | 'novo' | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregarEnderecos = useCallback(async (clienteId: string) => {
    const { data } = await supabase
      .from('enderecos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('padrao', { ascending: false })
      .order('criado_em', { ascending: true })
    setEnderecos((data as Endereco[]) ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/entrar?redirect=/conta')
        return
      }
      setCliente({
        id: user.id,
        nome: (user.user_metadata?.nome as string) ?? '',
        email: user.email ?? '',
      })
      await carregarEnderecos(user.id)
    }
    init()
  }, [router, carregarEnderecos])

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/entrar')
  }

  async function handleSalvar(valores: FormEndereco) {
    if (!cliente) return
    setSalvando(true)

    const payload = {
      apelido: valores.apelido.trim() || null,
      endereco: valores.endereco.trim(),
      complemento: valores.complemento.trim() || null,
      referencia: valores.referencia.trim() || null,
    }

    if (editando === 'novo') {
      // Primeiro endereço vira padrão automaticamente
      await supabase.from('enderecos').insert({
        ...payload,
        cliente_id: cliente.id,
        padrao: enderecos.length === 0,
      })
    } else if (editando) {
      await supabase.from('enderecos').update(payload).eq('id', editando)
    }

    await carregarEnderecos(cliente.id)
    setEditando(null)
    setSalvando(false)
  }

  async function handleExcluir(id: string) {
    if (!cliente) return
    await supabase.from('enderecos').delete().eq('id', id)
    await carregarEnderecos(cliente.id)
  }

  async function handleMarcarPadrao(id: string) {
    if (!cliente) return
    // Desmarca todos e marca apenas o escolhido
    await supabase.from('enderecos').update({ padrao: false }).eq('cliente_id', cliente.id)
    await supabase.from('enderecos').update({ padrao: true }).eq('id', id)
    await carregarEnderecos(cliente.id)
  }

  if (cliente === undefined) return null
  if (cliente === null) return null

  const enderecoEditando =
    editando && editando !== 'novo'
      ? enderecos.find(e => e.id === editando)
      : undefined

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* Header */}
      <header className="bg-surface border-b border-line sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Voltar"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={1.75} className="text-ink" />
          </button>
          <h1 className="text-base font-semibold text-ink flex-1">Minha conta</h1>
          <button
            onClick={handleSair}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:text-danger/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-2 py-1"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-6">

        {/* Dados do cliente */}
        <div className="bg-surface rounded-xl px-4 py-4 shadow-sm">
          {cliente.nome && (
            <p className="text-base font-semibold text-ink">{cliente.nome}</p>
          )}
          <p className="text-sm text-ink-soft mt-0.5">{cliente.email}</p>
        </div>

        {/* Endereços */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-ink">Meus endereços</h2>
            {editando === null && (
              <Button
                variant="secondary"
                className="!min-h-[40px] text-xs px-3"
                onClick={() => setEditando('novo')}
              >
                <Plus size={15} strokeWidth={2} />
                Adicionar
              </Button>
            )}
          </div>

          {/* Formulário novo endereço */}
          {editando === 'novo' && (
            <EnderecoForm
              inicial={FORM_VAZIO}
              salvando={salvando}
              onSalvar={handleSalvar}
              onCancelar={() => setEditando(null)}
            />
          )}

          {/* Lista de endereços */}
          {enderecos.length === 0 && editando !== 'novo' ? (
            <div className="rounded-xl border border-dashed border-line py-10 text-center">
              <MapPin size={28} strokeWidth={1.25} className="text-ink-mute mx-auto mb-2" />
              <p className="text-sm text-ink-soft">Nenhum endereço salvo ainda.</p>
              <p className="text-xs text-ink-mute mt-1">
                Adicione um para agilizar seus próximos pedidos.
              </p>
            </div>
          ) : (
            enderecos.map(end => (
              editando === end.id ? (
                <EnderecoForm
                  key={end.id}
                  inicial={{
                    apelido: end.apelido ?? '',
                    endereco: end.endereco,
                    complemento: end.complemento ?? '',
                    referencia: end.referencia ?? '',
                  }}
                  salvando={salvando}
                  onSalvar={handleSalvar}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <div key={end.id} className="bg-surface rounded-xl px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {end.apelido && (
                          <span className="text-sm font-semibold text-ink">{end.apelido}</span>
                        )}
                        {end.padrao && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-2 py-0.5">
                            <Star size={11} strokeWidth={2} className="fill-brand-700" />
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-soft mt-1 leading-snug">{end.endereco}</p>
                      {end.complemento && (
                        <p className="text-xs text-ink-mute mt-0.5">{end.complemento}</p>
                      )}
                      {end.referencia && (
                        <p className="text-xs text-ink-mute mt-0.5">Ref: {end.referencia}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-line">
                    {!end.padrao && (
                      <button
                        onClick={() => handleMarcarPadrao(end.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Star size={13} strokeWidth={1.75} />
                        Tornar padrão
                      </button>
                    )}
                    <button
                      onClick={() => setEditando(end.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:bg-brand-50 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ml-auto"
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(end.id)}
                      aria-label="Excluir endereço"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:bg-danger/10 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                      Excluir
                    </button>
                  </div>
                </div>
              )
            ))
          )}
        </section>
      </main>
    </div>
  )
}
