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
    // A unidade usada da última vez já vale enquanto a lista não chega: as telas começam a buscar seus dados em paralelo
    // (o banco só entrega o que esse login pode ver; se a salva não valer mais, a escolha é corrigida abaixo)
    try { const antes = localStorage.getItem(CHAVE); if (antes) setId(antes) } catch { /* sem armazenamento */ }
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
    <UnidadeContext.Provider value={{ unidades, unidade, unidadeId: unidade?.id ?? (pronto ? null : id), trocar, pronto }}>
      {children}
    </UnidadeContext.Provider>
  )
}
