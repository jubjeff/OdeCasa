import Link from 'next/link'

const LINKS_PRODUTO = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#precos',          label: 'Preços'         },
  { href: '#como-funciona',   label: 'Como funciona'  },
  { href: '#depoimentos',     label: 'Depoimentos'    },
]

const LINKS_ACESSO = [
  { href: '/login',    label: 'Entrar'    },
  { href: '/cadastro', label: 'Cadastrar' },
]

const LINKS_LEGAL = [
  { href: '/termos',      label: 'Termos de uso'   },
  { href: '/privacidade', label: 'Privacidade'     },
]

export function LandingFooter() {
  return (
    <footer className="bg-brand-900 dark:bg-brand-50 py-14">
      <div className="max-w-6xl mx-auto px-4">

        {/* Topo */}
        <div className="flex flex-col md:flex-row gap-10 md:gap-16 mb-12">

          {/* Marca */}
          <div className="max-w-xs">
            <Link href="/" aria-label="ÔdeCasa Delivery — início" className="inline-flex flex-col leading-none mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
              <span className="text-xl font-bold">
                <span className="text-brand-100 dark:text-brand-700">Ôde</span><span className="text-brand-400">Casa</span>
              </span>
              <span className="text-[11px] font-medium text-brand-300 dark:text-brand-500 tracking-wide">delivery</span>
            </Link>
            <p className="text-brand-200 dark:text-brand-600 text-sm leading-relaxed">
              Feito com 💚 pra negócios de bairro do Brasil.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-10 md:gap-16">

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-300 dark:text-brand-500 mb-4">Produto</p>
              <ul className="flex flex-col gap-2.5">
                {LINKS_PRODUTO.map(({ href, label }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-brand-200 dark:text-brand-600 hover:text-brand-50 dark:hover:text-brand-700 transition-colors duration-150"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-300 dark:text-brand-500 mb-4">Acesso</p>
              <ul className="flex flex-col gap-2.5">
                {LINKS_ACESSO.map(({ href, label }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-brand-200 dark:text-brand-600 hover:text-brand-50 dark:hover:text-brand-700 transition-colors duration-150"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-300 dark:text-brand-500 mb-4">Legal</p>
              <ul className="flex flex-col gap-2.5">
                {LINKS_LEGAL.map(({ href, label }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-brand-200 dark:text-brand-600 hover:text-brand-50 dark:hover:text-brand-700 transition-colors duration-150"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Rodapé da base */}
        <div className="border-t border-brand-700/40 dark:border-brand-200/20 pt-7">
          <p className="text-sm text-brand-300 dark:text-brand-500 text-center">
            © 2026 ÔdeCasa Delivery. Todos os direitos reservados.
          </p>
        </div>

      </div>
    </footer>
  )
}
