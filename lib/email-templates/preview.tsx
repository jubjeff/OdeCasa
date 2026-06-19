/**
 * Dados fictícios para visualização e testes dos templates de e-mail.
 *
 * O servidor de preview do React Email (`npm run email`) já renderiza cada
 * template automaticamente usando o `Component.PreviewProps` definido em cada
 * arquivo. Este módulo centraliza os mesmos conjuntos de dados de exemplo para
 * reuso (ex: testes de snapshot, geração de HTML estático) e serve como
 * documentação rápida das props de cada template.
 */

import type { OrderConfirmationEmailProps } from './order-confirmation'
import type { OrderStatusEmailProps } from './order-status'
import type { PasswordResetEmailProps } from './password-reset'
import type { WelcomeEmailProps } from './welcome'

export const exemploWelcome: WelcomeEmailProps = {
  nomeDono: 'Jefferson',
  nomeLoja: 'Jeff Store',
  urlPainel: 'https://odecasa.com.br/painel',
}

export const exemploOrderConfirmation: OrderConfirmationEmailProps = {
  nomeCliente: 'Maria',
  nomeLoja: 'Hortifruti do Zé',
  numeroPedido: '1042',
  itens: [
    { nome: 'Banana prata (kg)', quantidade: 2, subtotal: 11.8 },
    { nome: 'Tomate italiano (kg)', quantidade: 1, subtotal: 8.5 },
    { nome: 'Alface crespa (un.)', quantidade: 3, subtotal: 9.0 },
  ],
  taxaEntrega: 6,
  total: 35.3,
  urlPedido: 'https://odecasa.com.br/conta',
  whatsapp: '5581996393807',
}

export const exemploOrderStatus: OrderStatusEmailProps = {
  nomeCliente: 'Maria',
  nomeLoja: 'Hortifruti do Zé',
  numeroPedido: '1042',
  statusAtual: 'saiu_entrega',
  urlPedido: 'https://odecasa.com.br/conta',
  whatsapp: '5581996393807',
}

export const exemploPasswordReset: PasswordResetEmailProps = {
  nomeDestinatario: 'Jefferson',
  urlReset: 'https://odecasa.com.br/redefinir-senha?token=exemplo-abc123',
  expiraEm: '1 hora',
}

export const exemplos = {
  welcome: exemploWelcome,
  orderConfirmation: exemploOrderConfirmation,
  orderStatus: exemploOrderStatus,
  passwordReset: exemploPasswordReset,
} as const
