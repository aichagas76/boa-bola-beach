'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, Edit2, Check, X } from 'lucide-react'

type ContaBancaria = {
  id: string
  nome: string
}

export default function Contas() {
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [loading, setLoading] = useState(true)
  const [novaNome, setNovaNome] = useState('')

  const [editandoId, setEditandoId] = useState<string>('')
  const [editandoNome, setEditandoNome] = useState('')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('contas_bancarias').select('*').order('nome')
    setContas(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar() {
    if (!novaNome.trim()) return

    const { error } = await supabase.from('contas_bancarias').insert({
      nome: novaNome,
    })

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    setNovaNome('')
    carregar()
  }

  async function editar(id: string) {
    if (!editandoNome.trim()) return

    const { error } = await supabase.from('contas_bancarias').update({
      nome: editandoNome,
    }).eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    setEditandoId('')
    carregar()
  }

  async function deletar(id: string) {
    if (!confirm('Excluir esta conta?')) return

    const { error } = await supabase.from('contas_bancarias').delete().eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    carregar()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Contas Bancárias</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={novaNome}
            onChange={e => setNovaNome(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Nome da conta (ex: Banco do Brasil, Caixa Eletrônico...)"
            onKeyPress={e => e.key === 'Enter' && adicionar()}
          />
          <button
            onClick={adicionar}
            className="px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a]"
          >
            + Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : contas.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhuma conta cadastrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {editandoId === c.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editandoNome}
                            onChange={e => setEditandoNome(e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                            autoFocus
                          />
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => editar(c.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditandoId('')}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-gray-900">{c.nome}</td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => {
                              setEditandoId(c.id)
                              setEditandoNome(c.nome)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deletar(c.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
