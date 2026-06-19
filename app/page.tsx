import type { Metadata } from 'next'
import { LandingHeader }  from '@/components/landing/LandingHeader'
import { Hero }           from '@/components/landing/Hero'
import { Features }       from '@/components/landing/Features'
import { HowItWorks }     from '@/components/landing/HowItWorks'
import { Pricing }        from '@/components/landing/Pricing'
import { Testimonials }   from '@/components/landing/Testimonials'
import { FAQ }            from '@/components/landing/FAQ'
import { CTASection }     from '@/components/landing/CTASection'
import { LandingFooter }  from '@/components/landing/LandingFooter'

export const metadata: Metadata = {
  title: 'ÔdeCasa Delivery — Seu delivery, do seu jeito',
  description:
    'Crie a página da sua loja, receba pedidos e gerencie tudo num painel feito pra dono de negócio de bairro. Sem comissão por pedido.',
  openGraph: {
    title: 'ÔdeCasa Delivery — Seu delivery, do seu jeito',
    description: 'Delivery direto com o cliente. Sem comissão. Para negócios de bairro.',
    type: 'website',
  },
}

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTASection />
      </main>
      <LandingFooter />
    </>
  )
}
