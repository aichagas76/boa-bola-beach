'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/BB logo.jpg" alt="Boa Bola Beach" className="h-24 w-auto object-contain" />
        </div>

        <form onSubmit={entrar} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-8 space-y-4">
          <h1 className="text-lg font-semibold text-white mb-6">Entrar</h1>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7DC421]"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7DC421]"
              placeholder="••••••••"
            />
          </div>

          {erro && <p className="text-xs text-red-400">{erro}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7DC421] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#6ab01a] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
