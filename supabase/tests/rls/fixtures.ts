/**
 * Gerencia usuários, lojas e dados de teste para a suite RLS.
 *
 * Topology criada:
 *   Loja A  (dono_a) — ativa
 *     operadores: caixa_a (ativo), atendente_a (ativo), gerente_a (ativo),
 *                 inativo_a (inativo), pendente_a (pendente)
 *     categoria_a, produto_a1 (disponivel=true), produto_a2 (disponivel=false)
 *     pedido_a (cliente=cliente_a, status='preparando')
 *     avaliacao_a (nota=5)
 *
 *   Loja B  (dono_b) — ativa
 *     categoria_b, produto_b1 (disponivel=true)
 *
 *   sem_loja — usuário autenticado sem vínculo com nenhuma loja
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''

if (!SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY são obrigatórios.\n' +
    'Copie .env.test.example para .env.test e preencha os valores.'
  )
}

// ── Clientes base ─────────────────────────────────────────────────────────────

/** Cliente admin (bypassa RLS — use apenas em fixtures, nunca nos testes) */
export const adminClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Cliente anônimo (sem autenticação) */
export const anonClient: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TestUser {
  id: string
  email: string
  password: string
}

export interface TestFixtures {
  lojaAId: string
  lojaBId: string
  categoriaAId: string
  categoriaBId: string
  produtoA1Id: string  // disponivel=true
  produtoA2Id: string  // disponivel=false
  produtoBId: string
  pedidoAId: string
  avaliacaoAId: string
  users: {
    donoA: TestUser
    donoB: TestUser
    caixaA: TestUser      // papel=caixa,     status=ativo
    atendenteA: TestUser  // papel=atendente, status=ativo
    gerenteA: TestUser    // papel=gerente,   status=ativo
    inativoA: TestUser    // papel=caixa,     status=inativo
    pendenteA: TestUser   // papel=caixa,     status=pendente
    clienteA: TestUser    // cliente que fez pedido na Loja A
    semLoja: TestUser     // usuário sem vínculo com nenhuma loja
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const PASSWORD = 'RLS_test_2026!'
// Prefixo único por execução para evitar conflito entre runs paralelas
const PREFIX = `rls_${Date.now()}_`

async function createUser(email: string): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nome: `Teste ${email.split('@')[0]}` },
  })
  if (error) throw new Error(`Falha ao criar usuário ${email}: ${error.message}`)
  return data.user.id
}

async function insertSingle<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Promise<string> {
  const { data, error } = await adminClient.from(table).insert(row).select('id').single()
  if (error) throw new Error(`INSERT em ${table} falhou: ${error.message}`)
  return (data as { id: string }).id
}

export async function setupFixtures(): Promise<TestFixtures> {
  // 1. Usuários de teste
  const emails = {
    donoA:      `${PREFIX}dono_a@test.rls`,
    donoB:      `${PREFIX}dono_b@test.rls`,
    caixaA:     `${PREFIX}caixa_a@test.rls`,
    atendenteA: `${PREFIX}atendente_a@test.rls`,
    gerenteA:   `${PREFIX}gerente_a@test.rls`,
    inativoA:   `${PREFIX}inativo_a@test.rls`,
    pendenteA:  `${PREFIX}pendente_a@test.rls`,
    clienteA:   `${PREFIX}cliente_a@test.rls`,
    semLoja:    `${PREFIX}sem_loja@test.rls`,
  }

  const ids = {
    donoA:      await createUser(emails.donoA),
    donoB:      await createUser(emails.donoB),
    caixaA:     await createUser(emails.caixaA),
    atendenteA: await createUser(emails.atendenteA),
    gerenteA:   await createUser(emails.gerenteA),
    inativoA:   await createUser(emails.inativoA),
    pendenteA:  await createUser(emails.pendenteA),
    clienteA:   await createUser(emails.clienteA),
    semLoja:    await createUser(emails.semLoja),
  }

  // 2. Lojas
  const lojaAId = await insertSingle('lojas', {
    nome: `${PREFIX}Loja A`, slug: `${PREFIX}loja-a`,
    dono_id: ids.donoA, ativo: true,
  })
  const lojaBId = await insertSingle('lojas', {
    nome: `${PREFIX}Loja B`, slug: `${PREFIX}loja-b`,
    dono_id: ids.donoB, ativo: true,
  })

  // 3. Categorias
  const categoriaAId = await insertSingle('categorias', { loja_id: lojaAId, nome: `${PREFIX}Cat A` })
  const categoriaBId = await insertSingle('categorias', { loja_id: lojaBId, nome: `${PREFIX}Cat B` })

  // 4. Produtos
  const produtoA1Id = await insertSingle('produtos', {
    loja_id: lojaAId, categoria_id: categoriaAId,
    nome: `${PREFIX}Prod A1`, preco: 10.00, disponivel: true,
  })
  const produtoA2Id = await insertSingle('produtos', {
    loja_id: lojaAId, categoria_id: categoriaAId,
    nome: `${PREFIX}Prod A2`, preco: 20.00, disponivel: false,
  })
  const produtoBId = await insertSingle('produtos', {
    loja_id: lojaBId, categoria_id: categoriaBId,
    nome: `${PREFIX}Prod B1`, preco: 15.00, disponivel: true,
  })

  // 5. Pedido (inserido via admin para contornar RLS de cliente — testamos em separado)
  const pedidoAId = await insertSingle('pedidos', {
    loja_id: lojaAId,
    cliente_id: ids.clienteA,
    status: 'preparando',
    subtotal: 10.00,
    total: 10.00,
    nome_cliente: 'Cliente Teste RLS',
    telefone_cliente: '11999990000',
    endereco_entrega: 'Rua Teste RLS, 0',
    forma_pagamento: 'pix',
  })

  // 6. Avaliação
  const avaliacaoAId = await insertSingle('avaliacoes', {
    pedido_id: pedidoAId,
    loja_id: lojaAId,
    cliente_id: ids.clienteA,
    nota: 5,
    comentario: 'Teste RLS',
  })

  // 7. Operadores da Loja A
  const { error: opErr } = await adminClient.from('operadores').insert([
    { loja_id: lojaAId, user_id: ids.caixaA,     email: emails.caixaA,     papel: 'caixa',     status: 'ativo'    },
    { loja_id: lojaAId, user_id: ids.atendenteA, email: emails.atendenteA, papel: 'atendente', status: 'ativo'    },
    { loja_id: lojaAId, user_id: ids.gerenteA,   email: emails.gerenteA,   papel: 'gerente',   status: 'ativo'    },
    { loja_id: lojaAId, user_id: ids.inativoA,   email: emails.inativoA,   papel: 'caixa',     status: 'inativo'  },
    { loja_id: lojaAId, user_id: ids.pendenteA,  email: emails.pendenteA,  papel: 'caixa',     status: 'pendente' },
  ])
  if (opErr) throw new Error(`INSERT operadores falhou: ${opErr.message}`)

  const makeUser = (key: keyof typeof ids): TestUser => ({
    id: ids[key], email: emails[key], password: PASSWORD,
  })

  return {
    lojaAId, lojaBId,
    categoriaAId, categoriaBId,
    produtoA1Id, produtoA2Id, produtoBId,
    pedidoAId, avaliacaoAId,
    users: {
      donoA:      makeUser('donoA'),
      donoB:      makeUser('donoB'),
      caixaA:     makeUser('caixaA'),
      atendenteA: makeUser('atendenteA'),
      gerenteA:   makeUser('gerenteA'),
      inativoA:   makeUser('inativoA'),
      pendenteA:  makeUser('pendenteA'),
      clienteA:   makeUser('clienteA'),
      semLoja:    makeUser('semLoja'),
    },
  }
}

// ── Teardown ──────────────────────────────────────────────────────────────────

export async function teardownFixtures(fx: TestFixtures): Promise<void> {
  // Deleta em ordem reversa de FK
  await adminClient.from('operadores').delete().eq('loja_id', fx.lojaAId)
  await adminClient.from('avaliacoes').delete().eq('id', fx.avaliacaoAId)
  await adminClient.from('pedidos').delete().eq('id', fx.pedidoAId)
  await adminClient.from('produtos').delete().in('id', [fx.produtoA1Id, fx.produtoA2Id, fx.produtoBId])
  await adminClient.from('categorias').delete().in('id', [fx.categoriaAId, fx.categoriaBId])
  await adminClient.from('lojas').delete().in('id', [fx.lojaAId, fx.lojaBId])

  for (const user of Object.values(fx.users)) {
    await adminClient.auth.admin.deleteUser(user.id)
  }
}

// ── Helpers de autenticação ───────────────────────────────────────────────────

/** Cria um cliente Supabase autenticado como o usuário fornecido. */
export async function signInAs(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw new Error(`signIn(${user.email}): ${error.message}`)
  return client
}

// Os helpers abaixo usam `any` internamente porque o tipo do query builder do
// Supabase é recursivo e profundo — encadear .eq() via loop esgota a inferência.

/** SELECT: true se retornou ≥ 1 linha. Erros de permissão contam como 0 linhas. */
export async function canRead(
  client: SupabaseClient,
  table: string,
  filter: Record<string, unknown>,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client.from(table).select('id')
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
  const { data } = await q
  return (data ?? []).length > 0
}

/** UPDATE: true se não houve erro (RLS não bloqueou nem lançou with-check). */
export async function canUpdate(
  client: SupabaseClient,
  table: string,
  filter: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client.from(table).update(patch)
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
  const { error } = await q
  return error === null
}

/** INSERT: true se não houve erro. */
export async function canInsert(
  client: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await client.from(table).insert(row)
  return error === null
}

/** DELETE: true se não houve erro. */
export async function canDelete(
  client: SupabaseClient,
  table: string,
  filter: Record<string, unknown>,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client.from(table).delete()
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
  const { error } = await q
  return error === null
}
