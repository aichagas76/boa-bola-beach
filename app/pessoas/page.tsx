'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, Edit2, Check, X } from 'lucide-react'

type Pessoa = {
  id: string
  nome: string
  tipo: 'Fornecedor' | 'Cliente' | 'Ambos'
}

export default function Pessoas() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [novaNome, setNovaNome] = useState('')
  const [novoTipo, setNovoTipo] = useState<'Fornecedor' | 'Cliente' | 'Ambos'>('Cliente')

  const [editandoId, setEditandoId] = useState<string>('')
  const [editandoNome, setEditandoNome] = useState('')
  const [editandoTipo, setEditandoTipo] = useState<'Fornecedor' | 'Cliente' | 'Ambos'>('Cliente')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('pessoas').select('*').order('nome')
    setPessoas(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar() {
    if (!novaNome.trim()) return

    const { error } = await supabase.from('pessoas').insert({
      nome: novaNome,
      tipo: novoTipo,
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

    const { error } = await supabase.from('pessoas').update({
      nome: editandoNome,
      tipo: editandoTipo,
    }).eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    setEditandoId('')
    carregar()
  }

  async function deletar(id: string) {
    if (!confirm('Excluir esta pessoa?')) return

    const { error } = await supabase.from('pessoas').delete().eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    carregar()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Fornecedores/Clientes</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nome</label>
              <input
                type="text"
                value={novaNome}
                onChange={e => setNovaNome(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nome da pessoa"
                onKeyPress={e => e.key === 'Enter' && adicionar()}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo</label>
              <select
                value={novoTipo}
                onChange={e => setNovoTipo(e.target.value as 'Fornecedor' | 'Cliente' | 'Ambos')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="Cliente">Cliente</option>
                <option value="Fornecedor">Fornecedor</option>
                <option value="Ambos">Ambos</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={adicionar}
                className="w-full px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a]"
              >
                + Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : pessoas.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhuma pessoa cadastrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {editandoId === p.id ? (
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
                        <td className="px-4 py-3">
                          <select
                            value={editandoTipo}
                            onChange={e => setEditandoTipo(e.target.value as 'Fornecedor' | 'Cliente' | 'Ambos')}
                            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                          >
                            <option value="Cliente">Cliente</option>
                            <option value="Fornecedor">Fornecedor</option>
                            <option value="Ambos">Ambos</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => editar(p.id)}
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
                        <td className="px-4 py-3 text-gray-900">{p.nome}</td>
                        <td className="px-4 py-3 text-gray-600">{p.tipo}</td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => {
                              setEditandoId(p.id)
                              setEditandoNome(p.nome)
                              setEditandoTipo(p.tipo)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deletar(p.id)}
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
