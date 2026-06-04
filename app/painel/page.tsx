'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function Painel() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    async function verificarSessao() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card bodyClassName="p-8 text-center">
        <p className="text-base text-ink-soft">Bem-vindo de volta</p>
        <p className="text-[22px] font-bold text-ink mt-1">Olá, {email}</p>

        <Button
          variant="secondary"
          onClick={handleSair}
          className="mt-6 text-danger border-danger/30 hover:bg-danger/10 w-full"
        >
          Sair
        </Button>
      </Card>
    </main>
  )
}
