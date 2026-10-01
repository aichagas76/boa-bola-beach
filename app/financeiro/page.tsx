'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Trash2, Edit2, Check } from 'lucide-react'
type Movimentacao = {
  id: string
  data: string
  tipo: string
  descricao: string
  valor: number
  forma_pagamento: string
  status: string
  data_vencimento: string | null
  data_pagamento: string | null
  origem: string
  categorias_financeiro: { categoria: string; subcategoria: string } | null
  pessoas: { nome: string } | null
  contas_bancarias: { nome: string } | null
}

export default function Financeiro() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [ordenacao, setOrdenacao] = useState<{ coluna: 'data' | 'valor' | 'status' | 'vencimento', direcao: 'asc' | 'desc' }>({ coluna: 'data', direcao: 'desc' })

  async function carregar() {
    setLoading(true)

    const { data } = await supabase
      .from('movimentacoes')
      .select('*, pessoas(nome), contas_bancarias(nome)')
      .order('data', { ascending: false })
      .limit(100)

    setMovimentacoes(data ?? [])
    setLoading(false)
  }

  async function deletar(id: string) {
    if (!confirm('Excluir esta movimentação?')) return

    const { error } = await supabase
      .from('movimentacoes')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    carregar()
  }

  async function darBaixa(mov: Movimentacao) {
    if (!confirm('Confirmar baixa desta movimentação?')) return

    const novoStatus = mov.tipo === 'Entrada' ? 'Recebido' : 'Pago'
    const hoje = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('movimentacoes')
      .update({
        status: novoStatus,
        data_pagamento: hoje,
      })
      .eq('id', mov.id)

    if (error) {
      alert('Erro ao dar baixa: ' + error.message)
      return
    }

    carregar()
  }

  function alternarOrdenacao(coluna: 'data' | 'valor' | 'status' | 'vencimento') {
    if (ordenacao.coluna === coluna) {
      setOrdenacao({ ...ordenacao, direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc' })
    } else {
      setOrdenacao({ coluna, direcao: 'desc' })
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const { filtrados, totais } = useMemo(() => {
    let filtrados = movimentacoes.filter(m => {
      const matchTipo = filtroTipo === 'Todos' || m.tipo === filtroTipo
      const dataMes = m.data.substring(0, 7)
      const matchPeriodo = !filtroPeriodo || dataMes === filtroPeriodo
      return matchTipo && matchPeriodo
    })

    filtrados = filtrados.sort((a, b) => {
      const dir = ordenacao.direcao === 'asc' ? 1 : -1
      if (ordenacao.coluna === 'data') return (a.data > b.data ? 1 : -1) * dir
      if (ordenacao.coluna === 'valor') return (a.valor - b.valor) * dir
      if (ordenacao.coluna === 'status') return ((a.status || '') > (b.status || '') ? 1 : -1) * dir
      if (ordenacao.coluna === 'vencimento') return ((a.data_vencimento ?? '') > (b.data_vencimento ?? '') ? 1 : -1) * dir
      return 0
    })

    const entradasTotal = filtrados.filter(m => m.tipo === 'Entrada').reduce((acc, m) => acc + m.valor, 0)
    const saidasTotal = filtrados.filter(m => m.tipo === 'Saída').reduce((acc, m) => acc + m.valor, 0)

    return {
      filtrados,
      totais: {
        entradas: entradasTotal,
        saidas: saidasTotal,
        saldo: entradasTotal - saidasTotal,
      }
    }
  }, [movimentacoes, filtroTipo, filtroPeriodo, ordenacao])

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
              <th
                onClick={() => alternarOrdenacao('data')}
                className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
              >
                Data {ordenacao.coluna === 'data' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição</th>
              <th
                onClick={() => alternarOrdenacao('status')}
                className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
              >
                Status {ordenacao.coluna === 'status' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Pagamento</th>
              <th
                onClick={() => alternarOrdenacao('vencimento')}
                className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
              >
                Vencimento {ordenacao.coluna === 'vencimento' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => alternarOrdenacao('valor')}
                className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
              >
                Valor {ordenacao.coluna === 'valor' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhuma movimentação encontrada.</td></tr>
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
                <td className="px-4 py-3 text-gray-600">{m.descricao || '-'}</td>
                <td className="px-4 py-3">
                  {m.status && (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.status === 'Recebido' || m.status === 'Pago'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {m.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {m.data_pagamento ? new Date(m.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {m.data_vencimento ? new Date(m.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className={`px-4 py-3 font-medium ${m.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  {m.tipo === 'Entrada' ? '+' : '-'} R$ {m.valor.toFixed(2).replace('.', ',')}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  {(m.status === 'Pendente' || m.status === 'Não recebido') ? (
                    <button onClick={() => darBaixa(m)} className="text-green-600 hover:text-green-800" title="Dar baixa">
                      <Check size={16} />
                    </button>
                  ) : (
                    <div className="w-4" />
                  )}
                  <Link href={`/financeiro/${m.id}/editar`} className="text-blue-600 hover:text-blue-800">
                    <Edit2 size={16} />
                  </Link>
                  <button onClick={() => deletar(m.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
