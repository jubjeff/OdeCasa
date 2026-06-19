import Link from 'next/link'
import { Check } from 'lucide-react'

interface Plano {
  nome: string
  preco: string
  periodo: string
  descricao: string
  features: string[]
  destaque: boolean
  badge?: string
  cta: string
}

const PLANOS: Plano[] = [
  {
    nome: 'Grátis',
    preco: 'R$ 0',
    periodo: 'para começar',
    descricao: 'Perfeito para testar e dar os primeiros passos.',
    features: [
      'Até 30 pedidos por mês',
      'Cardápio digital completo',
      'Painel de gestão básico',
      'Link da loja personalizado',
      'Suporte por e-mail',
    ],
    destaque: false,
    cta: 'Começar grátis',
  },
  {
    nome: 'Crescimento',
    preco: 'R$ 49',
    periodo: '/mês',
    descricao: 'Para quem já vende e quer crescer sem limite.',
    features: [
      'Pedidos ilimitados',
      'Painel completo + relatórios',
      'Notificações WhatsApp',
      'Pix integrado por pedido',
      'Suporte prioritário',
    ],
    destaque: true,
    badge: 'Mais popular',
    cta: 'Assinar Crescimento',
  },
  {
    nome: 'Bairro+',
    preco: 'R$ 99',
    periodo: '/mês',
    descricao: 'Para negócios maiores com equipe e múltiplas frentes.',
    features: [
      'Tudo do Crescimento',
      'Múltiplos operadores',
      'Integrações avançadas',
      'Dashboard de faturamento',
      'Onboarding personalizado',
      'Suporte via WhatsApp',
    ],
    destaque: false,
    cta: 'Assinar Bairro+',
  },
]

export function Pricing() {
  return (
    <section id="precos" className="bg-surface py-20 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4">

        {/* Cabeçalho */}
        <div className="text-center max-w-2xl mx-auto mb-5">
          <p className="text-sm font-semibold text-brand-500 uppercase tracking-widest mb-3">Preços</p>
          <h2 className="text-[30px] sm:text-[36px] font-bold text-ink leading-tight mb-4">
            Simples, sem surpresa
          </h2>
          <p className="text-ink-soft text-lg leading-relaxed">
            Mensalidade fixa. Sem comissão por pedido, sem taxa oculta.
          </p>
        </div>

        {/* Nota de lançamento */}
        <p className="text-center text-sm text-ink-mute mb-10">
          * Planos em fase de lançamento — valores e recursos podem variar.
        </p>

        {/* Cards — scroll horizontal no mobile */}
        <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible">
          {PLANOS.map((plano) => (
            <div
              key={plano.nome}
              className={[
                'snap-center shrink-0 w-[285px] md:w-auto rounded-xl border p-7 flex flex-col transition-shadow duration-200',
                plano.destaque
                  ? 'border-brand-500 bg-brand-50 shadow-lg ring-2 ring-brand-500/20'
                  : 'border-line bg-bg hover:shadow-md',
              ].join(' ')}
            >
              {/* Badge */}
              <div className="h-6 mb-3">
                {plano.badge && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500 text-surface">
                    {plano.badge}
                  </span>
                )}
              </div>

              {/* Nome + preço */}
              <h3 className="text-lg font-bold text-ink mb-1">{plano.nome}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-bold text-ink">{plano.preco}</span>
                <span className="text-sm text-ink-soft">{plano.periodo}</span>
              </div>
              <p className="text-sm text-ink-soft mb-6">{plano.descricao}</p>

              {/* Features */}
              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plano.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <Check
                      size={16}
                      strokeWidth={2.5}
                      className="text-brand-500 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/cadastro"
                className={[
                  'flex items-center justify-center h-11 rounded-md font-semibold text-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  plano.destaque
                    ? 'bg-brand-500 text-surface hover:bg-brand-600 shadow-sm'
                    : 'border border-line bg-surface text-brand-700 hover:bg-brand-50',
                ].join(' ')}
              >
                {plano.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <p className="text-center text-sm text-ink-mute mt-8">
          Sem fidelidade. Cancele quando quiser.
        </p>

      </div>
    </section>
  )
}
