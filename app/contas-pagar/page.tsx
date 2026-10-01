'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Check } from 'lucide-react'

type Movimentacao = {
  id: string
  data_vencimento: string
  valor: number
  descricao: string | null
  status: string
  pessoas?: { nome: string }
  categorias_financeiro?: { categoria: string; subcategoria: string | null }
}

export default function ContasPagar() {
  const [contas, setContas] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('movimentacoes')
      .select('*, categorias_financeiro(categoria, subcategoria), pessoas(nome), contas_bancarias(nome)')
      .eq('tipo', 'Saída')
      .eq('status', 'Pendente')
      .order('data_vencimento', { ascending: true })

    console.log('Contas a pagar data:', data)
    console.log('Contas a pagar error:', error)
    console.log('Total encontrado:', data?.length)
    setContas(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function darBaixa(id: string) {
    if (!confirm('Confirmar baixa desta movimentação?')) return

    const hoje = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('movimentacoes')
      .update({
        status: 'Pago',
        data_pagamento: hoje,
      })
      .eq('id', id)

    if (error) {
      alert('Erro ao dar baixa: ' + error.message)
      return
    }

    carregar()
  }

  const hoje = new Date().toISOString().split('T')[0]
  const totalPagar = contas.reduce((acc, c) => acc + c.valor, 0)
  const vencido = contas.filter(c => c.data_vencimento <= hoje).reduce((acc, c) => acc + c.valor, 0)
  const aVencer = totalPagar - vencido

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Contas a Pagar</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-red-500 rounded-xl p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total a Pagar</div>
          <div className="text-3xl font-bold text-red-600">
            R$ {totalPagar.toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div className="bg-white border border-red-500 rounded-xl p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Vencido</div>
          <div className="text-3xl font-bold text-red-600">
            R$ {vencido.toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div className="bg-white border border-blue-500 rounded-xl p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">A Vencer</div>
          <div className="text-3xl font-bold text-blue-600">
            R$ {aVencer.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fornecedor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && contas.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhuma conta a pagar.</td></tr>
            )}
            {contas.map((c, i) => {
              const vencido = c.data_vencimento <= hoje
              return (
                <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === contas.length - 1 ? 'border-0' : ''}`}>
                  <td className={`px-4 py-3 font-medium ${vencido ? 'text-red-600' : 'text-gray-600'}`}>
                    {new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.pessoas?.nome || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.categorias_financeiro?.categoria || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.descricao || '-'}</td>
                  <td className="px-4 py-3 font-medium text-red-600">
                    - R$ {c.valor.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => darBaixa(c.id)}
                      className="text-green-600 hover:text-green-800"
                      title="Dar baixa"
                    >
                      <Check size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
