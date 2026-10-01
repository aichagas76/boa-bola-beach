'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import { usePagination } from '@/lib/hooks/usePagination'
import { Pagination } from '@/components/ui/pagination'

type Aluno = { id: string; nome: string; asaas_customer_id: string | null }

type Movimentacao = {
  id: string
  valor: number
  status: string
  data_vencimento: string | null
  data_pagamento: string | null
  forma_pagamento: string | null
  descricao: string | null
  link_pagamento: string | null
  categorias_financeiro: { categoria: string; subcategoria: string | null } | null
}

export default function Pagamentos() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [periodo, setPeriodo] = useState('semana')
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)

  function obterDatasFiltro(periodo: string) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    let dataInicio = new Date(hoje)

    if (periodo === 'semana') dataInicio.setDate(dataInicio.getDate() - 7)
    else if (periodo === 'mes') dataInicio.setDate(1)

    return dataInicio.toISOString().split('T')[0]
  }

  useEffect(() => {
    supabase.from('alunos').select('id, nome, asaas_customer_id').order('nome').then(({ data }) => {
      setAlunos(data ?? [])
    })
  }, [])

  useEffect(() => {
    loadPayments()
  }, [periodo])

  async function loadPayments() {
    setLoading(true)
    const dataInicio = obterDatasFiltro(periodo)

    const { data, error } = await supabase
      .from('movimentacoes')
      .select('*')

    if (error || !data) {
      setMovimentacoes([])
      setLoading(false)
      return
    }

    const filtered = data
      .filter(m => m.tipo === 'Entrada')
      .filter(m => m.status !== 'Recebido')
      .filter(m => {
        const dataVenc = new Date(m.data_vencimento || '')
        const dataInicioDt = new Date(dataInicio)
        return dataVenc >= dataInicioDt
      })
      .sort((a, b) =>
        new Date(b.data_vencimento || '').getTime() -
        new Date(a.data_vencimento || '').getTime()
      )

    setMovimentacoes(filtered)
    setLoading(false)
  }

  async function darBaixa(mov: Movimentacao) {
    setBaixandoId(mov.id)
    const hoje = new Date().toLocaleDateString('en-CA')
    const { error } = await supabase
      .from('movimentacoes')
      .update({ status: 'Recebido', data_pagamento: hoje })
      .eq('id', mov.id)
    if (error) { alert('Erro: ' + error.message); setBaixandoId(null); return }
    await registrarLog('Baixa pagamento', 'movimentacoes', mov.id, 'Pagamento')
    setTimeout(() => window.location.reload(), 800)
  }

  const totalPago = movimentacoes
    .filter(m => m.status === 'Recebido')
    .reduce((acc, m) => acc + (m.valor ?? 0), 0)

  const totalPendente = movimentacoes
    .filter(m => m.status !== 'Recebido')
    .reduce((acc, m) => acc + (m.valor ?? 0), 0)

  const ultimoPagamento = movimentacoes
    .filter(m => m.status === 'Recebido' && m.data_pagamento)
    .sort((a, b) => (b.data_pagamento ?? '').localeCompare(a.data_pagamento ?? ''))[0]

  function corStatus(status: string) {
    return status === 'Recebido' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
  }

  function formatarCompetencia(dataVencimento: string | null) {
    if (!dataVencimento) return '-'
    return new Date(dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  }

  const pagination = usePagination(movimentacoes, 15)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-gray-900">Pagamentos</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <label className="text-xs text-gray-500 block mb-2">Período</label>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriodo('dia')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              periodo === 'dia'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Do dia
          </button>
          <button
            onClick={() => setPeriodo('semana')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              periodo === 'semana'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            7 dias
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              periodo === 'mes'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Do mês
          </button>
        </div>
      </div>

      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Total pago</div>
              <div className="text-lg font-semibold text-green-700">
                R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Total pendente</div>
              <div className="text-lg font-semibold text-yellow-700">
                R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Último pagamento</div>
              <div className="text-lg font-semibold text-gray-700">
                {ultimoPagamento?.data_pagamento
                  ? new Date(ultimoPagamento.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')
                  : '-'}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Competência</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Data Pagamento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Forma Pagamento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Link</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">Carregando...</td></tr>
                  )}
                  {!loading && movimentacoes.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhum pagamento encontrado.</td></tr>
                  )}
                  {pagination.paginatedItems.map((m, i) => (
                    <tr key={m.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === pagination.paginatedItems.length - 1 && pagination.currentPage === pagination.totalPages ? 'border-0' : ''}`}>
                    <td className="px-4 py-3 text-gray-600 text-xs">{formatarCompetencia(m.data_vencimento)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.categorias_financeiro?.subcategoria || m.categorias_financeiro?.categoria || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium text-xs">
                      R$ {m.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${corStatus(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.data_pagamento
                        ? new Date(m.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{m.forma_pagamento || '-'}</td>
                    <td className="px-4 py-3 text-xs">
                      {m.link_pagamento
                        ? <a href={m.link_pagamento} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">🔗 Pagar</a>
                        : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {m.status === 'Não recebido' && (
                        <button
                          onClick={() => darBaixa(m)}
                          disabled={baixandoId === m.id}
                          className="px-3 py-1 text-xs bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
                        >
                          {baixandoId === m.id ? '...' : 'Dar baixa'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.goToPage}
            />
          </div>
      </>
    </div>
  )
}
