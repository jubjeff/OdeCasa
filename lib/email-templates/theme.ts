/**
 * Tokens do design system OdeCasa — "delivery premium, verde".
 *
 * Clientes de e-mail não leem CSS variables, então os valores precisam ser
 * hex fixos inline. Estes são exatamente os mesmos tokens definidos no tema
 * do projeto (globals.css / Tailwind) — qualquer cor nova deve sair daqui,
 * nunca de hex solto nos templates.
 */

export const cores = {
  // Marca (verde)
  brand50:  '#F2FAF5',
  brand100: '#E2F4EA',
  brand200: '#BEE7CF',
  brand300: '#8AD4AC',
  brand400: '#45BC83',
  brand500: '#0E9F5E', // principal
  brand600: '#0B7E4A', // hover
  brand700: '#096038',
  brand900: '#06351F', // superfícies escuras (header)

  // Neutros (tom quente)
  bg:      '#FAFAF7',
  surface: '#FFFFFF',
  line:    '#E9E8E2',
  ink:     '#16201A',
  inkSoft: '#51594F',
  inkMute: '#8A918A',

  // Apoio
  accent: '#F5A524',
  danger: '#E5484D',
} as const

/**
 * Plus Jakarta Sans é a fonte da marca, mas e-mail HTML não garante fontes
 * customizadas. O fallback (Helvetica Neue/Arial) é o que de fato aparece na
 * maioria dos clients — foi escolhido para se manter visualmente aceitável.
 */
export const fontePadrao =
  "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif"

/** Largura máxima recomendada para e-mails (compatível com Outlook). */
export const larguraMax = 600

/**
 * Logo configurável por ambiente. Se NEXT_PUBLIC_LOGO_URL estiver definida,
 * os templates usam <Img>; caso contrário, caem no logo de texto estilizado.
 */
export const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL ?? ''

/** Marca e textos institucionais reutilizados nos rodapés. */
export const marca = {
  nome: 'ÔdeCasa',
  tagline: 'Seu delivery, do seu jeito. Direto com o cliente.',
  ano: new Date().getFullYear(),
} as const

/** Formata um número como moeda brasileira (R$). */
export function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
