'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, Tags } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'

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
  const [contagem, setContagem]     = useState<Record<string, number>>({})

  // Formulário de adição
  const [novaCategoria, setNovaCategoria] = useState('')
  const [adicionando, setAdicionando]     = useState(false)
  const [mostrarForm, setMostrarForm]     = useState(false)

  // Diálogo de confirmação
  const [dialogo, setDialogo] = useState<{ mensagem: string; onConfirmar: () => void } | null>(null)

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
        await Promise.all([
          buscarCategorias(lojaEncontrada.id),
          buscarContagem(lojaEncontrada.id),
        ])
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

  // Quantos produtos há em cada categoria
  async function buscarContagem(lojaId: string) {
    const { data } = await supabase
      .from('produtos')
      .select('categoria_id')
      .eq('loja_id', lojaId)

    const mapa: Record<string, number> = {}
    for (const row of (data as { categoria_id: string | null }[] | null) ?? []) {
      if (row.categoria_id) mapa[row.categoria_id] = (mapa[row.categoria_id] ?? 0) + 1
    }
    setContagem(mapa)
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

    const { error } = await supabase.from('categorias').insert({
      loja_id: loja.id,
      nome: novaCategoria.trim(),
      ordem: proximaOrdem,
    })

    if (error) {
      toast.error('Não foi possível criar a categoria')
    } else {
      setNovaCategoria('')
      await buscarCategorias(loja.id)
      toast.success('Categoria criada')
    }
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

    const { error } = await supabase
      .from('categorias')
      .update({ nome: nomeEditando.trim() })
      .eq('id', cat.id)

    setEditandoId(null)
    setSalvandoEdicao(false)
    if (error) {
      toast.error('Não foi possível salvar a categoria')
    } else {
      await buscarCategorias(loja.id)
      toast.success('Categoria atualizada')
    }
  }

  /* ── Excluir ────────────────────────────────────── */

  function excluir(cat: Categoria) {
    if (!loja) return
    setDialogo({
      mensagem: `Excluir a categoria "${cat.nome}"?`,
      onConfirmar: async () => {
        setDialogo(null)
        const { error } = await supabase.from('categorias').delete().eq('id', cat.id)
        if (error) { toast.error('Não foi possível excluir a categoria'); return }
        await buscarCategorias(loja.id)
        toast.success('Categoria excluída')
      },
    })
  }

  /* ── Render ─────────────────────────────────────── */

  // Carregando
  if (loja === undefined) {
    return (
      <main className="py-8">
        <PageContainer size="wide" className="flex flex-col gap-6">
          <Skeleton className="h-7 w-40" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-lg shadow-sm px-4 py-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </PageContainer>
      </main>
    )
  }

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
    <>
    <main className="py-8">
      <PageContainer size="wide" className="flex flex-col gap-6">

        {/* Topo: título + Nova categoria */}
        <SectionTitle
          count={categorias.length}
          action={
            <Button onClick={() => setMostrarForm(v => !v)} className="!min-h-[40px] text-sm px-4">
              <Plus size={16} strokeWidth={2} />
              Nova categoria
            </Button>
          }
        >
          Categorias
        </SectionTitle>

        {/* Formulário de adição (toggle) */}
        {mostrarForm && (
          <Card bodyClassName="p-4">
            <form onSubmit={handleAdicionar} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  id="nova-categoria"
                  placeholder="Ex.: Pizzas, Bebidas, Sobremesas…"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" disabled={adicionando}>
                {adicionando ? 'Adicionando…' : 'Adicionar'}
              </Button>
            </form>
          </Card>
        )}

        {/* Empty state ou lista */}
        {categorias.length === 0 ? (
          <Card bodyClassName="p-10 text-center">
            <Tags size={32} strokeWidth={1.25} className="text-ink-mute mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink">Organize seu cardápio em categorias</p>
            <p className="text-xs text-ink-mute mt-1 mb-4">
              Agrupe seus produtos para o cliente encontrar mais fácil.
            </p>
            <Button onClick={() => setMostrarForm(true)}>Criar primeira categoria</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {categorias.map((cat) => {
              const qtd = contagem[cat.id] ?? 0
              return (
                <Card key={cat.id} bodyClassName="px-4 py-3">
                  {editandoId === cat.id ? (
                    /* Modo edição */
                    <div className="space-y-2">
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
                      <div className="flex gap-2">
                        <Button onClick={() => salvarEdicao(cat)} disabled={salvandoEdicao} className="flex-1 !min-h-[40px] px-3 text-sm">
                          Salvar
                        </Button>
                        <Button variant="secondary" onClick={() => setEditandoId(null)} className="!min-h-[40px] px-3 text-sm">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Modo visualização */
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{cat.nome}</p>
                        <p className="text-xs text-ink-mute mt-0.5">
                          {qtd} {qtd === 1 ? 'produto' : 'produtos'}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Editar categoria"
                        aria-label="Editar categoria"
                        onClick={() => iniciarEdicao(cat)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Pencil size={15} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        title="Excluir categoria"
                        aria-label="Excluir categoria"
                        onClick={() => excluir(cat)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Trash2 size={15} strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

      </PageContainer>
    </main>

    {dialogo && (
      <ConfirmDialog
        mensagem={dialogo.mensagem}
        onConfirmar={dialogo.onConfirmar}
        onCancelar={() => setDialogo(null)}
      />
    )}
    </>
  )
}
