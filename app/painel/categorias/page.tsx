'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

/* ── Tipos ─────────────────────────────────────────── */

interface Loja {
  id: string
  nome: string
}

interface Categoria {
  id: string
  loja_id: string
  nome: string
  ordem: number
  criado_em: string
}

/* ── Página ─────────────────────────────────────────── */

export default function Categorias() {
  const router = useRouter()

  const [loja, setLoja]             = useState<Loja | null | undefined>(undefined)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  // Formulário de adição
  const [novaCategoria, setNovaCategoria] = useState('')
  const [adicionando, setAdicionando]     = useState(false)

  // Edição inline
  const [editandoId, setEditandoId]       = useState<string | null>(null)
  const [nomeEditando, setNomeEditando]   = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  /* ── Inicialização ──────────────────────────────── */

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('lojas')
        .select('id, nome')
        .eq('dono_id', user.id)
        .maybeSingle()

      const lojaEncontrada = data ? (data as Loja) : null
      setLoja(lojaEncontrada)

      if (lojaEncontrada) {
        await buscarCategorias(lojaEncontrada.id)
      }
    }

    init()
  }, [router])

  /* ── Helpers ────────────────────────────────────── */

  async function buscarCategorias(lojaId: string) {
    const { data } = await supabase
      .from('categorias')
      .select('*')
      .eq('loja_id', lojaId)
      .order('ordem')

    setCategorias((data as Categoria[]) ?? [])
  }

  /* ── Adicionar ──────────────────────────────────── */

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!loja || !novaCategoria.trim()) return

    setAdicionando(true)

    const proximaOrdem =
      categorias.length > 0
        ? Math.max(...categorias.map((c) => c.ordem)) + 1
        : 0

    await supabase.from('categorias').insert({
      loja_id: loja.id,
      nome: novaCategoria.trim(),
      ordem: proximaOrdem,
    })

    setNovaCategoria('')
    await buscarCategorias(loja.id)
    setAdicionando(false)
  }

  /* ── Editar ─────────────────────────────────────── */

  function iniciarEdicao(cat: Categoria) {
    setEditandoId(cat.id)
    setNomeEditando(cat.nome)
  }

  async function salvarEdicao(cat: Categoria) {
    if (!nomeEditando.trim() || !loja) return

    setSalvandoEdicao(true)

    await supabase
      .from('categorias')
      .update({ nome: nomeEditando.trim() })
      .eq('id', cat.id)

    setEditandoId(null)
    setSalvandoEdicao(false)
    await buscarCategorias(loja.id)
  }

  /* ── Excluir ────────────────────────────────────── */

  async function excluir(cat: Categoria) {
    if (!loja) return
    if (!window.confirm(`Excluir a categoria "${cat.nome}"?`)) return

    await supabase.from('categorias').delete().eq('id', cat.id)
    await buscarCategorias(loja.id)
  }

  /* ── Render ─────────────────────────────────────── */

  // Carregando
  if (loja === undefined) return null

  // Sem loja
  if (loja === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <Card bodyClassName="p-8 text-center max-w-sm">
          <p className="text-base font-semibold text-ink mb-1">
            Nenhuma loja encontrada
          </p>
          <p className="text-sm text-ink-soft mb-6">
            Crie sua loja primeiro para gerenciar categorias.
          </p>
          <Link href="/painel">
            <Button className="w-full">Ir para o painel</Button>
          </Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-10">
      <div className="max-w-lg mx-auto flex flex-col gap-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-soft">Categorias</p>
            <p className="text-base font-semibold text-ink mt-0.5">{loja.nome}</p>
          </div>
          <Link href="/painel">
            <Button variant="secondary">← Painel</Button>
          </Link>
        </div>

        {/* Formulário de adição */}
        <Card bodyClassName="p-6">
          <h2 className="text-[18px] font-semibold text-ink mb-4">
            Nova categoria
          </h2>
          <form onSubmit={handleAdicionar} className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                id="nova-categoria"
                placeholder="Ex.: Pizzas, Bebidas, Sobremesas…"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={adicionando}>
              {adicionando ? 'Adicionando…' : 'Adicionar'}
            </Button>
          </form>
        </Card>

        {/* Lista de categorias */}
        <Card bodyClassName="p-6">
          <h2 className="text-[18px] font-semibold text-ink mb-1">
            Categorias{' '}
            <span className="text-ink-mute font-normal text-base">
              ({categorias.length})
            </span>
          </h2>

          {categorias.length === 0 ? (
            <p className="text-sm text-ink-mute text-center py-6">
              Nenhuma categoria ainda. Adicione a primeira acima.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-line">
              {categorias.map((cat) => (
                <li key={cat.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {editandoId === cat.id ? (
                    /* Modo edição */
                    <>
                      <div className="flex-1">
                        <Input
                          id={`edit-${cat.id}`}
                          value={nomeEditando}
                          onChange={(e) => setNomeEditando(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); salvarEdicao(cat) }
                            if (e.key === 'Escape') setEditandoId(null)
                          }}
                        />
                      </div>
                      <Button
                        onClick={() => salvarEdicao(cat)}
                        disabled={salvandoEdicao}
                      >
                        Salvar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEditandoId(null)}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    /* Modo visualização */
                    <>
                      <span className="flex-1 text-sm font-medium text-ink">
                        {cat.nome}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => iniciarEdicao(cat)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-danger hover:bg-danger/10"
                        onClick={() => excluir(cat)}
                      >
                        Excluir
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

      </div>
    </main>
  )
}
