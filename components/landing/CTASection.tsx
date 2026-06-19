import Link from 'next/link'

export function CTASection() {
  return (
    <section className="bg-brand-600 py-20">
      <div className="max-w-3xl mx-auto px-4 text-center">

        <h2 className="text-[30px] sm:text-[38px] font-bold text-surface leading-tight mb-5">
          Pronto pra ter seu delivery do seu jeito?
        </h2>
        <p className="text-brand-100 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          Crie sua loja agora, é grátis e leva menos de 5 minutos. Seus clientes já estão esperando.
        </p>

        <Link
          href="/cadastro"
          className="inline-flex items-center gap-2 h-14 px-10 rounded-md bg-surface text-brand-700 font-bold text-base hover:bg-brand-50 active:scale-[0.98] transition-all duration-150 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
        >
          Criar minha loja grátis →
        </Link>

        <p className="text-brand-200 text-sm mt-6">
          Sem cartão de crédito · Sem fidelidade · Cancele quando quiser
        </p>

      </div>
    </section>
  )
}
