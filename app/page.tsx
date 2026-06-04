import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { MapPin, Truck, ArrowRight, Sprout } from 'lucide-react'

/* ── Busca server-side (sem login, chave anon) ───── */

interface Loja {
  nome: string
  slug: string
  endereco: string | null
  taxa_entrega: number
  logo_url: string | null
}

async function getLoja(): Promise<Loja | null> {
  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data } = await client
      .from('lojas')
      .select('nome, slug, endereco, taxa_entrega, logo_url')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    return (data as Loja) ?? null
  } catch {
    return null
  }
}

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/* ── Página ──────────────────────────────────────── */

export default async function Home() {
  const loja = await getLoja()

  return (
    <main className="min-h-screen bg-brand-900 flex flex-col font-sans">

      {/* Marca */}
      <div className="px-6 pt-8 shrink-0">
        <p className="text-brand-400 text-sm font-semibold tracking-widest">
          OdeCasa
        </p>
      </div>

      {/* Herói */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">

        {loja ? (
          <>
            {/* Logo */}
            {loja.logo_url && (
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand-600 mb-6 shadow-lg">
                <img src={loja.logo_url} alt={loja.nome} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Nome da loja */}
            <h1 className="text-[34px] leading-tight font-bold text-surface sm:text-5xl max-w-sm">
              {loja.nome}
            </h1>

            {/* Informações */}
            <div className="mt-5 flex flex-col items-center gap-2.5">
              {loja.endereco && (
                <p className="flex items-center gap-2 text-brand-300 text-sm">
                  <MapPin size={14} strokeWidth={1.75} className="shrink-0" />
                  {loja.endereco}
                </p>
              )}
              <p className="flex items-center gap-2 text-brand-300 text-sm">
                <Truck size={14} strokeWidth={1.75} className="shrink-0" />
                {loja.taxa_entrega === 0
                  ? 'Entrega grátis'
                  : `Entrega ${formatarReal(loja.taxa_entrega)}`}
              </p>
            </div>

            {/* CTA */}
            <Link
              href={`/loja/${loja.slug}`}
              className={[
                'mt-10 inline-flex items-center justify-center gap-2',
                'min-h-[52px] px-8 rounded-xl',
                'bg-surface text-brand-900 font-bold text-base',
                'hover:bg-brand-50 active:scale-[0.98]',
                'transition-all duration-150 shadow-lg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
              ].join(' ')}
            >
              Ver cardápio
              <ArrowRight size={18} strokeWidth={2.25} />
            </Link>
          </>
        ) : (
          /* Estado "Em breve" */
          <>
            <div className="w-16 h-16 rounded-full bg-brand-700/40 flex items-center justify-center mb-6">
              <Sprout size={30} strokeWidth={1.5} className="text-brand-300" />
            </div>

            <h1 className="text-[34px] font-bold text-surface">Em breve</h1>

            <p className="mt-4 text-brand-300 text-base max-w-[260px] leading-relaxed">
              Nossa loja está sendo preparada com muito carinho. Volte em breve!
            </p>
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="px-6 pb-8 text-center shrink-0">
        <p className="text-brand-700 text-xs">Delivery fresco, com cuidado</p>
      </div>

    </main>
  )
}
