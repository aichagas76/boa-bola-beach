'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, Edit2, Check, X } from 'lucide-react'

type Banco = {
  id: string
  nome: string
}

export default function Bancos() {
  const [bancos, setBancos] = useState<Banco[]>([])
  const [loading, setLoading] = useState(true)
  const [novoNome, setNovoNome] = useState('')

  const [editandoId, setEditandoId] = useState<string>('')
  const [editandoNome, setEditandoNome] = useState('')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('bancos').select('id, nome').order('nome')
    setBancos(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function mensagemDeErro(error: { code?: string; message: string }) {
    return error.code === '23505' ? 'Já existe um banco com este nome.' : 'Erro: ' + error.message
  }

  async function adicionar() {
    if (!novoNome.trim()) return

    const { error } = await supabase.from('bancos').insert({ nome: novoNome.trim() })
    if (error) {
      alert(mensagemDeErro(error))
      return
    }

    setNovoNome('')
    carregar()
  }

  async function editar(id: string) {
    if (!editandoNome.trim()) return

    const { error } = await supabase.from('bancos').update({ nome: editandoNome.trim() }).eq('id', id)
    if (error) {
      alert(mensagemDeErro(error))
      return
    }

    setEditandoId('')
    carregar()
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este banco? Os lançamentos que usam ele ficam sem banco.')) return

    const { error } = await supabase.from('bancos').delete().eq('id', id)
    if (error) {
      alert(mensagemDeErro(error))
      return
    }

    carregar()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-page-title text-gray-900 mb-6">Bancos</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            className="flex-1 min-w-0 h-10 border border-gray-200 rounded-lg px-3 text-sm"
            placeholder="Nome do banco (ex: Itaú, Nubank, Banco do Brasil...)"
            onKeyDown={e => e.key === 'Enter' && adicionar()}
          />
          <button
            onClick={adicionar}
            className="h-10 px-4 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a]"
          >
            + Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : bancos.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhum banco cadastrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-th text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-th text-gray-500 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {bancos.map(b => (
                <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {editandoId === b.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editandoNome}
                          onChange={e => setEditandoNome(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && editar(b.id)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => editar(b.id)} className="text-green-600 hover:text-green-800" title="Salvar"><Check size={16} /></button>
                          <button onClick={() => setEditandoId('')} className="text-gray-600 hover:text-gray-800" title="Cancelar"><X size={16} /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-900">{b.nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditandoId(b.id); setEditandoNome(b.nome) }} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => deletar(b.id)} className="text-red-600 hover:text-red-800" title="Excluir"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
