# OdeCasa

App de delivery multi-loja. O gerente cadastra produtos/preços/estoque; o cliente
monta o pedido. Um mesmo sistema atende vários estabelecimentos (multi-tenant).

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (banco PostgreSQL, Auth, Storage) via @supabase/supabase-js
- Ícones: lucide-react

## Regras invioláveis
- Nunca escreva cor em hex solto no JSX. Use SEMPRE os tokens de design
  (definidos no tema do Tailwind / globals.css). Cor nova = adicionar token, não hardcode.
- Mobile-first: desenhe primeiro pra tela de celular; desktop é adaptação.
- Ao criar pedido de cliente sem login, NUNCA encadeie .select() depois do
  .insert() — o RLS bloqueia o retorno. Insira sem retornar.
- Trabalhe em passos pequenos: uma funcionalidade por vez, sem criar telas extras não pedidas.

## Sistema de design — "delivery premium, verde"

Sensação alvo: fresco, confiável, apetitoso. Muito espaço em branco, hierarquia
clara, verde como cor de marca, fotos de produto em destaque. Nada de poluído.

### Cores (tokens)
Marca (verde) — usar brand-500 pra ações principais:
- brand-50  #F2FAF5   (fundos suaves, estado selecionado)
- brand-100 #E2F4EA   (badges, chips)
- brand-200 #BEE7CF
- brand-300 #8AD4AC
- brand-400 #45BC83
- brand-500 #0E9F5E   (principal: botões, links, destaque)
- brand-600 #0B7E4A   (hover)
- brand-700 #096038   (texto sobre verde claro, estado pressionado)
- brand-900 #06351F   (superfícies escuras: rodapé, headers escuros)

Neutros (tom quente, nunca cinza-azulado):
- bg        #FAFAF7   (fundo da página)
- surface   #FFFFFF   (cards, barras)
- line      #E9E8E2   (bordas fininhas / hairline)
- ink       #16201A   (texto principal)
- ink-soft  #51594F   (texto secundário)
- ink-mute  #8A918A   (texto terciário, placeholders)

Apoio (usar com parcimônia):
- accent    #F5A524   (avaliações, selo de promoção/frescor)
- danger    #E5484D   (erro, cancelado)

Status do pedido (cor das pílulas):
- recebido → neutro (line + ink-soft) · preparando → accent
- saiu_entrega → brand-300 · entregue → brand-500 · cancelado → danger

### Tipografia
- Fonte: "Plus Jakarta Sans" (Google Fonts), fallback system-ui, sans-serif.
- Pesos: 400 / 500 / 600 / 700. Sempre sentence case (nada de CAIXA ALTA).
- Escala: h1 28-32px/700 · h2 22px/700 · h3 18px/600 · corpo 16px/400 (line-height 1.6)
  · pequeno 14px · legenda 12px.
- Preço em destaque: 18-20px/700 na cor brand-700.

### Forma e profundidade
- Raios: sm 8 · md 12 · lg 16 · xl 20 · full (pílulas/avatares).
  Cards = lg/xl. Botões/inputs = md. Chips de categoria = full.
- Sombras (suaves, baixa opacidade — premium não usa borda dura):
  - sm: 0 1px 2px rgba(16,32,26,.05)
  - md: 0 4px 16px rgba(16,32,26,.06)
  - lg: 0 12px 32px rgba(16,32,26,.10)
- Espaçamento na grade de 4px. Respiro generoso entre seções.

### Componentes base (criar como componentes reutilizáveis)
- Botão primário: fundo brand-500, hover brand-600, texto branco, raio md,
  altura mín. 48px, peso 600, leve scale(.98) ao pressionar, transição 150ms.
- Botão secundário: fundo surface, borda line, texto brand-700, mesma altura/raio.
- Botão fantasma: só texto brand-700, sem fundo.
- Campo de formulário: altura 48px, raio md, borda line, foco com anel brand-500
  (2px), placeholder ink-mute, rótulo 14px/500 acima do campo.
- Card de produto: surface, raio lg, sombra sm (md no hover), foto no topo em
  proporção 4:3 (object-cover), nome 16px/600, preço em destaque, unidade em legenda.
- Chip de categoria: pílula em rolagem horizontal. Selecionado = brand-100 +
  texto brand-700; normal = surface + borda line + texto ink-soft.
- Pílula de status: fundo claro + texto na cor do status (ver acima).
- Barra superior: surface, borda inferior hairline, nome da loja + ícone do carrinho.
- Navegação inferior (mobile): surface, borda superior hairline, item ativo brand-500.
- Estado vazio: ícone discreto + frase curta + ação. Nunca tela em branco.

### Movimento e ícones
- Transições 150-200ms ease-out, sutis. Respeitar prefers-reduced-motion.
- Ícones lucide-react, traço ~1.75, tamanho 20-24px.
- Alvos de toque mínimos de 44x44px. Sempre ter foco visível (acessibilidade).
