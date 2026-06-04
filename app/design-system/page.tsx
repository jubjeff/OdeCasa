import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { StatusBadge, OrderStatus } from '@/components/ui/StatusBadge'

/* ── Dados estáticos para exibição ─────────────────────── */

const BRAND_COLORS = [
  { name: 'brand-50',  hex: '#F2FAF5', dark: false },
  { name: 'brand-100', hex: '#E2F4EA', dark: false },
  { name: 'brand-200', hex: '#BEE7CF', dark: false },
  { name: 'brand-300', hex: '#8AD4AC', dark: false },
  { name: 'brand-400', hex: '#45BC83', dark: false },
  { name: 'brand-500', hex: '#0E9F5E', dark: true  },
  { name: 'brand-600', hex: '#0B7E4A', dark: true  },
  { name: 'brand-700', hex: '#096038', dark: true  },
  { name: 'brand-900', hex: '#06351F', dark: true  },
]

const NEUTRAL_COLORS = [
  { name: 'bg',       hex: '#FAFAF7', dark: false },
  { name: 'surface',  hex: '#FFFFFF', dark: false },
  { name: 'line',     hex: '#E9E8E2', dark: false },
  { name: 'ink',      hex: '#16201A', dark: true  },
  { name: 'ink-soft', hex: '#51594F', dark: true  },
  { name: 'ink-mute', hex: '#8A918A', dark: true  },
]

const SUPPORT_COLORS = [
  { name: 'accent', hex: '#F5A524', dark: false },
  { name: 'danger', hex: '#E5484D', dark: true  },
]

const STATUSES: OrderStatus[] = [
  'recebido',
  'preparando',
  'saiu_entrega',
  'entregue',
  'cancelado',
]

/* ── Componente auxiliar de amostra de cor ──────────────── */

function ColorSwatch({
  name,
  hex,
  dark,
}: {
  name: string
  hex: string
  dark: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-14 rounded-md border border-line"
        style={{ background: hex }}
      />
      <p className="text-xs font-medium text-ink">{name}</p>
      <p className="text-xs text-ink-mute font-mono">{hex}</p>
    </div>
  )
}

/* ── Seção com título ───────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-[22px] font-bold text-ink border-b border-line pb-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

/* ── Página ─────────────────────────────────────────────── */

export default function DesignSystem() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 md:px-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">

        {/* Cabeçalho */}
        <div>
          <h1 className="text-[32px] font-bold text-ink">Design System</h1>
          <p className="mt-2 text-ink-soft">OdeCasa · delivery premium, verde</p>
        </div>

        {/* ── Cores ────────────────────────────────────── */}
        <Section title="Cores">
          <div>
            <p className="text-sm font-medium text-ink-soft mb-3">Marca</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {BRAND_COLORS.map((c) => (
                <ColorSwatch key={c.name} {...c} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-soft mb-3">Neutros</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {NEUTRAL_COLORS.map((c) => (
                <ColorSwatch key={c.name} {...c} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-soft mb-3">Apoio</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {SUPPORT_COLORS.map((c) => (
                <ColorSwatch key={c.name} {...c} />
              ))}
            </div>
          </div>
        </Section>

        {/* ── Tipografia ───────────────────────────────── */}
        <Section title="Tipografia">
          <div className="flex flex-col gap-4">
            <p className="text-[32px] font-bold text-ink leading-tight">
              h1 · 32px / 700
            </p>
            <p className="text-[22px] font-bold text-ink">h2 · 22px / 700</p>
            <p className="text-[18px] font-semibold text-ink">h3 · 18px / 600</p>
            <p className="text-base text-ink leading-relaxed">
              Corpo · 16px / 400 · linha 1.6 — "Fresco, confiável, apetitoso."
            </p>
            <p className="text-sm text-ink-soft">Pequeno · 14px / 400</p>
            <p className="text-xs text-ink-mute">Legenda · 12px / 400</p>
            <p className="text-[18px] font-bold text-brand-700">
              Preço · R$ 29,90
            </p>
          </div>
        </Section>

        {/* ── Botões ───────────────────────────────────── */}
        <Section title="Botões">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Fantasma</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled>Primário desabilitado</Button>
            <Button variant="secondary" disabled>Secundário desabilitado</Button>
          </div>
        </Section>

        {/* ── Inputs ───────────────────────────────────── */}
        <Section title="Campo de formulário">
          <div className="flex flex-col gap-4 max-w-sm">
            <Input label="E-mail" id="demo-email" type="email" placeholder="seu@email.com" />
            <Input label="Senha" id="demo-senha" type="password" placeholder="••••••••" />
            <Input id="demo-sem-label" placeholder="Sem rótulo" />
          </div>
        </Section>

        {/* ── Cards ────────────────────────────────────── */}
        <Section title="Card de produto">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card
              name="X-Burguer Artesanal"
              price="R$ 32,90"
              unit="acompanha batata frita"
            />
            <Card
              image="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"
              imageAlt="Hambúrguer"
              name="Smash Burger"
              price="R$ 28,00"
              unit="200g de carne"
            />
            <Card
              image="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop"
              imageAlt="Pizza"
              name="Pizza Margherita"
              price="R$ 49,90"
              unit="tamanho grande · 8 fatias"
            />
          </div>
        </Section>

        {/* ── Status ───────────────────────────────────── */}
        <Section title="Pílulas de status do pedido">
          <div className="flex flex-wrap gap-3">
            {STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </Section>

        {/* ── Raios e sombras ──────────────────────────── */}
        <Section title="Raios e sombras">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'sm · 8px',  cls: 'rounded-sm shadow-sm'  },
              { label: 'md · 12px', cls: 'rounded-md shadow-md'  },
              { label: 'lg · 16px', cls: 'rounded-lg shadow-lg'  },
              { label: 'xl · 20px', cls: 'rounded-xl shadow-lg'  },
            ].map(({ label, cls }) => (
              <div
                key={label}
                className={`bg-surface h-20 flex items-end p-3 ${cls}`}
              >
                <span className="text-xs text-ink-mute">{label}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </main>
  )
}
