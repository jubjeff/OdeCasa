'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TesteConexao() {
  const [status, setStatus] = useState<string>('Testando conexão...')

  useEffect(() => {
    async function testar() {
      const { error } = await supabase.from('lojas').select('*')
      if (error) {
        setStatus(`Erro: ${error.message}`)
      } else {
        setStatus('Conexão OK')
      }
    }
    testar()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-lg font-medium">{status}</p>
    </main>
  )
}
