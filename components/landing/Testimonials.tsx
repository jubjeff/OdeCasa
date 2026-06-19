const DEPOIMENTOS = [
  {
    iniciais: 'MR',
    nome: 'Márcia Rodrigues',
    negocio: 'Quitanda da Márcia',
    cidade: 'Recife, PE',
    nota: 5,
    frase:
      'Antes eu perdia pedido por não ter onde anotar. Agora chega tudo no painel e eu gerencio de casa. Nunca fui de tecnologia mas aprendi em um dia.',
  },
  {
    iniciais: 'JS',
    nome: 'João Santos',
    negocio: 'Açaí do João',
    cidade: 'Fortaleza, CE',
    nota: 5,
    frase:
      'A minha loja ficou profissional com o link próprio. Coloquei no Instagram e as vendas aumentaram. Sem pagar comissão pra ninguém.',
  },
  {
    iniciais: 'FA',
    nome: 'Fátima Alves',
    negocio: 'Marmitex da Fátima',
    cidade: 'Salvador, BA',
    nota: 5,
    frase:
      'O suporte é muito bom, me ajudaram a montar tudo via WhatsApp. Recomendo pra qualquer dono de negócio de bairro que queira vender mais.',
  },
]

function Estrelas({ nota }: { nota: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Avaliação ${nota} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < nota ? 'text-accent' : 'text-ink-mute'} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  )
}

export function Testimonials() {
  return (
    <section id="depoimentos" className="bg-bg py-20 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4">

        {/* Cabeçalho */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-brand-500 uppercase tracking-widest mb-3">Depoimentos</p>
          <h2 className="text-[30px] sm:text-[36px] font-bold text-ink leading-tight mb-4">
            Negócios de bairro que já vendem pelo ÔdeCasa
          </h2>
          <p className="text-xs text-ink-mute mt-2">
            * Depoimentos ilustrativos. Nomes e negócios fictícios — depoimentos reais em breve.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DEPOIMENTOS.map((d) => (
            <div
              key={d.nome}
              className="bg-surface rounded-xl border border-line p-7 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200"
            >
              {/* Estrelas */}
              <Estrelas nota={d.nota} />

              {/* Frase */}
              <p className="text-ink-soft text-sm leading-relaxed flex-1">
                &ldquo;{d.frase}&rdquo;
              </p>

              {/* Autor */}
              <div className="flex items-center gap-3 pt-2 border-t border-line">
                <div className="w-10 h-10 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center shrink-0">
                  <span className="text-brand-700 font-bold text-sm">{d.iniciais}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink leading-tight">{d.nome}</p>
                  <p className="text-xs text-ink-mute">{d.negocio} · {d.cidade}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
