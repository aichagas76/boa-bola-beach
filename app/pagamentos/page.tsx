'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'

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
  const [alunoSelecionado, setAlunoSelecionado] = useState('')
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('alunos').select('id, nome, asaas_customer_id').order('nome').then(({ data }) => {
      setAlunos(data ?? [])
    })
  }, [])

  useEffect(() => {
    if (!alunoSelecionado) { setMovimentacoes([]); return }
    setLoading(true)
    supabase
      .from('movimentacoes')
      .select('*, categorias_financeiro(categoria, subcategoria), link_pagamento')
      .eq('aluno_ref_id', alunoSelecionado)
      .eq('tipo', 'Entrada')
      .order('data_vencimento', { ascending: false })
      .then(({ data }) => {
        setMovimentacoes(data ?? [])
        setLoading(false)
      })
  }, [alunoSelecionado])

  async function darBaixa(mov: Movimentacao) {
    setBaixandoId(mov.id)
    const hoje = new Date().toLocaleDateString('en-CA')
    const { error } = await supabase
      .from('movimentacoes')
      .update({ status: 'Recebido', data_pagamento: hoje })
      .eq('id', mov.id)
    if (error) { alert('Erro: ' + error.message); setBaixandoId(null); return }
    const alunoNome = alunos.find(a => a.id === alunoSelecionado)?.nome ?? alunoSelecionado
    await registrarLog('Baixa pagamento', 'movimentacoes', mov.id, alunoNome)
    setMovimentacoes(prev => prev.map(m =>
      m.id === mov.id ? { ...m, status: 'Recebido', data_pagamento: hoje } : m
    ))
    setBaixandoId(null)
  }

  const totalPago = movimentacoes
    .filter(m => m.status === 'Recebido')
    .reduce((acc, m) => acc + (m.valor ?? 0), 0)

  const totalPendente = movimentacoes
    .filter(m => m.status === 'Não recebido')
    .reduce((acc, m) => acc + (m.valor ?? 0), 0)

  const ultimoPagamento = movimentacoes
    .filter(m => m.status === 'Recebido' && m.data_pagamento)
    .sort((a, b) => (b.data_pagamento ?? '').localeCompare(a.data_pagamento ?? ''))[0]

  function corStatus(status: string) {
    if (status === 'Recebido') return 'bg-green-50 text-green-700'
    return 'bg-yellow-50 text-yellow-700'
  }

  function formatarCompetencia(dataVencimento: string | null) {
    if (!dataVencimento) return '-'
    return new Date(dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-gray-900">Pagamentos</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <label className="text-xs text-gray-500 block mb-1">Aluno</label>
        <select
          value={alunoSelecionado}
          onChange={e => setAlunoSelecionado(e.target.value)}
          className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Selecione um aluno...</option>
          {alunos.map(a => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      </div>

      {!alunoSelecionado && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Selecione um aluno para ver o histórico
        </div>
      )}

      {alunoSelecionado && (
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

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Competência</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Data Pagamento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Forma Pagamento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">ID Asaas</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Link</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">Carregando...</td></tr>
                )}
                {!loading && movimentacoes.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">Nenhum pagamento encontrado.</td></tr>
                )}
                {movimentacoes.map((m, i) => (
                  <tr key={m.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === movimentacoes.length - 1 ? 'border-0' : ''}`}>
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
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {alunos.find(a => a.id === alunoSelecionado)?.asaas_customer_id ?? '-'}
                    </td>
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
        </>
      )}
    </div>
  )
}
