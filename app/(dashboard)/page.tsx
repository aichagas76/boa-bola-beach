'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [totalAtivos, setTotalAtivos] = useState(0)
  const [totalInativos, setTotalInativos] = useState(0)
  const [receitaMensal, setReceitaMensal] = useState(0)
  const [totalAtrasados, setTotalAtrasados] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: alunos } = await supabase
        .from('alunos')
        .select('id, status')

      const { data: matriculas } = await supabase
        .from('matriculas')
        .select('aluno_id, valor')

      const { data: pagamentos } = await supabase
        .from('pagamentos')
        .select('status')

      const ativos = (alunos ?? []).filter(a => a.status === 'Ativo')
      const inativos = (alunos ?? []).filter(a => a.status === 'Inativo')
      const idsAtivos = new Set(ativos.map(a => a.id))

      const receita = (matriculas ?? [])
        .filter(m => idsAtivos.has(m.aluno_id))
        .reduce((acc, m) => acc + (m.valor ?? 0), 0)

      const atrasados = (pagamentos ?? []).filter(p => p.status === 'Atrasado').length

      setTotalAtivos(ativos.length)
      setTotalInativos(inativos.length)
      setReceitaMensal(receita)
      setTotalAtrasados(atrasados)
      setLoading(false)
    }
    carregar()
  }, [])

  const cards = [
    {
      label: 'Alunos ativos',
      value: loading ? '...' : totalAtivos,
      sub: `${totalInativos} inativos`,
      icon: '👥',
      href: '/alunos',
    },
    {
      label: 'Receita mensal',
      value: loading ? '...' : `R$ ${receitaMensal.toFixed(2).replace('.', ',')}`,
      sub: 'soma das mensalidades ativas',
      icon: '💰',
      href: '/pagamentos',
    },
    {
      label: 'Em atraso',
      value: loading ? '...' : totalAtrasados,
      sub: 'cobranças em atraso',
      icon: '⚠️',
      href: '/pagamentos',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {cards.map(card => (
          <Link key={card.label} href={card.href}>
            <div className="bg-white border border-[#7DC421] rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-1">{card.label}</div>
                  <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                </div>
                <div className="text-4xl opacity-60 group-hover:opacity-100 transition-opacity">{card.icon}</div>
              </div>
              <div className="text-xs text-gray-500">{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-xl p-6">
        <div className="text-sm font-semibold text-gray-900 mb-4">Acesso rápido</div>
        <div className="flex gap-3">
          <Link href="/alunos/novo" className="px-4 py-2.5 text-sm bg-[#7DC421] text-white font-medium rounded-lg hover:bg-[#6ab01a] transition-colors">
            + Novo aluno
          </Link>
          <Link href="/alunos" className="px-4 py-2.5 text-sm border border-[#e5e5e5] rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Ver alunos
          </Link>
          <Link href="/pagamentos" className="px-4 py-2.5 text-sm border border-[#e5e5e5] rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Ver pagamentos
          </Link>
        </div>
      </div>
    </div>
  )
}