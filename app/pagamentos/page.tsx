'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Pagamento = {
  id: string
  aluno_id: string
  aluno_nome: string
  valor: number
  status: string
  data_vencimento: string
  data_pagamento: string | null
  competencia: string
}

export default function Pagamentos() {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroMes, setFiltroMes] = useState('')

  async function carregar() {
    setLoading(true)

    const { data } = await supabase
      .from('pagamentos')
      .select('*, alunos(nome)')
      .order('data_vencimento', { ascending: false })

    const lista = (data ?? []).map((p: any) => ({
      ...p,
      aluno_nome: p.alunos?.nome ?? '-',
    }))

    setPagamentos(lista)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const mesesDisponiveis = [...new Set(pagamentos.map(p => p.competencia).filter(Boolean))].sort().reverse()

  const filtrados = pagamentos.filter(p => {
    const matchStatus = filtroStatus === 'Todos' || p.status === filtroStatus
    const matchMes = !filtroMes || p.competencia === filtroMes
    return matchStatus && matchMes
  })

  const contadores = {
    Todos: pagamentos.length,
    Pendente: pagamentos.filter(p => p.status === 'Pendente').length,
    Pago: pagamentos.filter(p => p.status === 'Pago').length,
    Atrasado: pagamentos.filter(p => p.status === 'Atrasado').length,
  }

  function corStatus(status: string) {
    if (status === 'Pago') return 'bg-green-50 text-green-700'
    if (status === 'Atrasado') return 'bg-red-50 text-red-700'
    return 'bg-yellow-50 text-yellow-700'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-gray-900">Pagamentos</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-2">
          {(['Todos', 'Pendente', 'Pago', 'Atrasado'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filtroStatus === f
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f} ({contadores[f as keyof typeof contadores] ?? 0})
            </button>
          ))}
        </div>

        {mesesDisponiveis.length > 0 && (
          <select
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-600"
          >
            <option value="">Todos os meses</option>
            {mesesDisponiveis.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Aluno</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Competência</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Pagamento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum pagamento encontrado.</td></tr>
            )}
            {filtrados.map((p, i) => (
              <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === filtrados.length - 1 ? 'border-0' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{p.aluno_nome}</td>
                <td className="px-4 py-3 text-gray-600">{p.competencia || '-'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {p.data_vencimento ? new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  R$ {p.valor?.toFixed(2).replace('.', ',')}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {p.data_pagamento ? new Date(p.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${corStatus(p.status)}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}