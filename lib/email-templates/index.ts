/**
 * Ponto único de importação dos templates de e-mail do ÔdeCasa.
 *
 * Os templates são componentes React reais (React Email) — sem {{handlebars}}.
 * Para enviar de fato, renderize com `render()` de @react-email/components e
 * passe o HTML ao serviço de envio (Resend/SMTP/etc.) — etapa separada.
 */

export { BaseLayout, type BaseLayoutProps } from './BaseLayout'

export { WelcomeEmail, type WelcomeEmailProps } from './welcome'
export {
  OrderConfirmationEmail,
  type OrderConfirmationEmailProps,
  type ItemPedido,
} from './order-confirmation'
export {
  OrderStatusEmail,
  type OrderStatusEmailProps,
  type StatusNotificavel,
} from './order-status'
export { PasswordResetEmail, type PasswordResetEmailProps } from './password-reset'
export { ConfirmacaoContaEmail, type ConfirmacaoContaEmailProps } from './confirmacao-conta'

export { cores, fontePadrao, marca, formatarReal } from './theme'
