'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Movimentacao = {
  id: string
  tipo: 'Entrada' | 'Saída'
  categoria: string
  subcategoria: string | null
  data: string
  descricao: string | null
  valor: number
  forma_pagamento: string
}

export default function Financeiro() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  async function carregar() {
    setLoading(true)

    const { data } = await supabase
      .from('movimentacoes')
      .select('*')
      .order('data', { ascending: false })

    setMovimentacoes(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = movimentacoes.filter(m => {
    const matchTipo = filtroTipo === 'Todos' || m.tipo === filtroTipo
    const dataMes = m.data.substring(0, 7)
    const matchPeriodo = !filtroPeriodo || dataMes === filtroPeriodo
    return matchTipo && matchPeriodo
  })

  const entradasTotal = filtrados.filter(m => m.tipo === 'Entrada').reduce((acc, m) => acc + m.valor, 0)
  const saidasTotal = filtrados.filter(m => m.tipo === 'Saída').reduce((acc, m) => acc + m.valor, 0)
  const totais = {
    entradas: entradasTotal,
    saidas: saidasTotal,
    saldo: entradasTotal - saidasTotal,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Financeiro</h1>
        <Link
          href="/financeiro/novo"
          className="px-4 py-2.5 text-sm bg-[#7DC421] text-white font-medium rounded-lg hover:bg-[#6ab01a] transition-colors"
        >
          + Nova movimentação
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-[#7DC421] rounded-xl p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Entradas</div>
          <div className="text-3xl font-bold text-green-600">
            R$ {totais.entradas.toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div className="bg-white border border-[#7DC421] rounded-xl p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Saídas</div>
          <div className="text-3xl font-bold text-red-600">
            R$ {totais.saidas.toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div className="bg-white border border-[#7DC421] rounded-xl p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Saldo</div>
          <div className={`text-3xl font-bold ${totais.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            R$ {totais.saldo.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Período</label>
            <input
              type="month"
              value={filtroPeriodo}
              onChange={e => setFiltroPeriodo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="Todos">Todos</option>
              <option value="Entrada">Entradas</option>
              <option value="Saída">Saídas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
              <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Subcategoria</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
              <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Forma Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhuma movimentação encontrada.</td></tr>
            )}
            {filtrados.map((m, i) => (
              <tr key={m.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === filtrados.length - 1 ? 'border-0' : ''}`}>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    m.tipo === 'Entrada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {m.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{m.categoria}</td>
                <td className="hidden md:table-cell px-4 py-3 text-gray-600">{m.subcategoria || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{m.descricao || '-'}</td>
                <td className={`px-4 py-3 font-medium ${m.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  {m.tipo === 'Entrada' ? '+' : '-'} R$ {m.valor.toFixed(2).replace('.', ',')}
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-gray-600">{m.forma_pagamento}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
