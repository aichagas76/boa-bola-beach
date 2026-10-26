'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { carregarCatalogo, type Unidade } from '@/lib/esportes-db'

type Ctx = {
  unidades: Unidade[] // só as que este login pode usar
  unidade: Unidade | null // a escolhida no menu
  unidadeId: string | null
  trocar: (id: string) => void
  pronto: boolean
}

const UnidadeContext = createContext<Ctx>({ unidades: [], unidade: null, unidadeId: null, trocar: () => {}, pronto: false })
const CHAVE = 'unidade_atual'

export function useUnidade() {
  return useContext(UnidadeContext)
}

export default function UnidadeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [id, setId] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  const carregar = useCallback(async () => {
    const { unidades: libs } = await carregarCatalogo(supabase)
    setUnidades(libs)
    let salva: string | null = null
    try { salva = localStorage.getItem(CHAVE) } catch { /* sem armazenamento: usa a primeira */ }
    setId(libs.find(u => u.id === salva)?.id ?? libs[0]?.id ?? null)
    setPronto(true)
  }, [])

  // Carrega ao abrir e de novo depois do login (quando a lista ainda estava vazia)
  useEffect(() => {
    if (pathname === '/login') return
    if (!pronto || unidades.length === 0) carregar()
  }, [pathname, pronto, unidades.length, carregar])

  const trocar = useCallback((novo: string) => {
    setId(novo)
    try { localStorage.setItem(CHAVE, novo) } catch { /* ignora */ }
  }, [])

  const unidade = unidades.find(u => u.id === id) ?? null

  return (
    <UnidadeContext.Provider value={{ unidades, unidade, unidadeId: unidade?.id ?? null, trocar, pronto }}>
      {children}
    </UnidadeContext.Provider>
  )
}
