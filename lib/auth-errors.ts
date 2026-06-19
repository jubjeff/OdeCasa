const MAPA: Record<string, string> = {
  'Invalid login credentials':
    'E-mail ou senha incorretos. Verifique seus dados e tente novamente.',
  'Email not confirmed':
    'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
  'User already registered':
    'Esse e-mail já possui uma conta. Tente entrar ou recuperar sua senha.',
  'Password should be at least 6 characters':
    'A senha deve ter no mínimo 6 caracteres.',
  'New password should be different from the old password':
    'A nova senha deve ser diferente da senha atual.',
  'Error sending confirmation email':
    'Não foi possível enviar o e-mail de confirmação. Tente novamente em instantes.',
  'Signups not allowed for this instance':
    'Cadastros estão temporariamente indisponíveis. Tente novamente mais tarde.',
  'signup_disabled':
    'Cadastros estão temporariamente indisponíveis.',
  'Email rate limit exceeded':
    'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar novamente.',
  'For security purposes, you can only request this after':
    'Por segurança, aguarde 60 segundos antes de tentar novamente.',
  'Token has expired or is invalid':
    'Este link expirou ou já foi utilizado. Solicite um novo.',
  'Unable to validate email address: invalid format':
    'Formato de e-mail inválido.',
  'over_email_send_rate_limit':
    'Limite de envios atingido. Aguarde alguns minutos e tente novamente.',
}

export function traduzirErroAuth(message: string): string {
  for (const [chave, traducao] of Object.entries(MAPA)) {
    if (message.toLowerCase().includes(chave.toLowerCase())) return traducao
  }
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
