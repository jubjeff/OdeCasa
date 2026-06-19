import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import { cores, fontePadrao, larguraMax, LOGO_URL, marca } from './theme'

export interface BaseLayoutProps {
  /** Preheader — texto que aparece na prévia da caixa de entrada. */
  preheader: string
  children: React.ReactNode
  /**
   * E-mails transacionais de segurança (ex: redefinição de senha) NÃO devem
   * ter link de descadastro. Os de relacionamento devem.
   */
  mostrarDescadastro?: boolean
  /** URL de descadastro (usada apenas quando mostrarDescadastro = true). */
  urlDescadastro?: string
}

/* ── Logo: <Img> se configurada, senão texto estilizado ──────────────── */

function Logo() {
  if (LOGO_URL) {
    return (
      <Img
        src={LOGO_URL}
        alt="ÔdeCasa delivery"
        width={150}
        height={40}
        style={{ display: 'block', border: '0' }}
      />
    )
  }
  return (
    <>
      <Text
        style={{
          margin: '0',
          fontFamily: fontePadrao,
          fontSize: '26px',
          fontWeight: 700,
          lineHeight: '1',
          color: cores.surface,
        }}
      >
        Ôde
        <span style={{ color: cores.brand300 }}>Casa</span>
      </Text>
      <Text
        style={{
          margin: '4px 0 0',
          fontFamily: fontePadrao,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          lineHeight: '1',
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        delivery
      </Text>
    </>
  )
}

/* ── Layout base reutilizável ────────────────────────────────────────── */

export function BaseLayout({
  preheader,
  children,
  mostrarDescadastro = false,
  urlDescadastro = '#',
}: BaseLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head>
        <Font
          fontFamily="Plus Jakarta Sans"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NShXUEKi4Rw.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preheader}</Preview>
      <Body
        style={{
          margin: '0',
          padding: '0',
          backgroundColor: cores.bg,
          fontFamily: fontePadrao,
        }}
      >
        <Container
          style={{
            width: '100%',
            maxWidth: `${larguraMax}px`,
            margin: '0 auto',
            padding: '24px 0 32px',
          }}
        >
          {/* Header — gradiente brand-900 → brand-600 (fallback sólido p/ Outlook) */}
          <Section
            style={{
              backgroundColor: cores.brand900,
              backgroundImage: `linear-gradient(135deg, ${cores.brand900} 0%, ${cores.brand600} 100%)`,
              borderRadius: '16px 16px 0 0',
              padding: '32px 32px',
              textAlign: 'center' as const,
            }}
          >
            <Logo />
          </Section>

          {/* Conteúdo */}
          <Section
            style={{
              backgroundColor: cores.surface,
              padding: '32px',
              borderLeft: `1px solid ${cores.line}`,
              borderRight: `1px solid ${cores.line}`,
            }}
          >
            {children}
          </Section>

          {/* Footer */}
          <Section
            style={{
              backgroundColor: cores.surface,
              padding: '0 32px 28px',
              borderRadius: '0 0 16px 16px',
              borderLeft: `1px solid ${cores.line}`,
              borderRight: `1px solid ${cores.line}`,
              borderBottom: `1px solid ${cores.line}`,
            }}
          >
            <Hr style={{ borderColor: cores.line, margin: '0 0 20px' }} />
            <Text
              style={{
                margin: '0 0 4px',
                fontFamily: fontePadrao,
                fontSize: '14px',
                fontWeight: 700,
                color: cores.ink,
              }}
            >
              {marca.nome}
            </Text>
            <Text
              style={{
                margin: '0 0 16px',
                fontFamily: fontePadrao,
                fontSize: '13px',
                lineHeight: '1.6',
                color: cores.inkSoft,
              }}
            >
              {marca.tagline}
            </Text>
            <Text
              style={{
                margin: '0',
                fontFamily: fontePadrao,
                fontSize: '12px',
                color: cores.inkMute,
              }}
            >
              © {marca.ano} {marca.nome} Delivery. Todos os direitos reservados.
            </Text>
            {mostrarDescadastro && (
              <Text
                style={{
                  margin: '12px 0 0',
                  fontFamily: fontePadrao,
                  fontSize: '12px',
                  color: cores.inkMute,
                }}
              >
                Não quer mais receber estes e-mails?{' '}
                <Link
                  href={urlDescadastro}
                  style={{ color: cores.brand600, textDecoration: 'underline' }}
                >
                  Descadastrar
                </Link>
                .
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default BaseLayout
