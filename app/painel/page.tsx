'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Painel() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    async function verificarSessao() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setEmail(session.user.email ?? null)
      }
    }
    verificarSessao()
  }, [router])

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!email) return null

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-xl bg-white p-8 shadow text-center">
        <p className="text-lg font-medium text-gray-800">Olá, {email}</p>
        <button
          onClick={handleSair}
          className="mt-4 rounded-lg bg-red-500 px-6 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Sair
        </button>
      </div>
    </main>
  )
}
