'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2 } from 'lucide-react'

type Modalidade = { id: string; nome: string; ativo: boolean }

// Têm tela própria no cadastro do aluno (combo, professor); podem ser desativadas, mas não apagadas
const FIXAS = ['Clubinho', 'Aula', 'Ranking']

export default function Modalidades() {
  const [lista, setLista] = useState<Modalidade[]>([])
  const [loading, setLoading] = useState(true)
  const [novoNome, setNovoNome] = useState('')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('modalidades').select('id, nome, ativo').order('nome')
    setLista(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function mensagemDeErro(error: { code?: string; message: string }) {
    return error.code === '23505' ? 'Já existe uma modalidade com este nome.' : 'Erro: ' + error.message
  }

  async function adicionar() {
    if (!novoNome.trim()) return
    const { error } = await supabase.from('modalidades').insert({ nome: novoNome.trim() })
    if (error) return alert(mensagemDeErro(error))
    setNovoNome('')
    carregar()
  }

  async function alternar(m: Modalidade) {
    const { error } = await supabase.from('modalidades').update({ ativo: !m.ativo }).eq('id', m.id)
    if (error) return alert(mensagemDeErro(error))
    carregar()
  }

  async function deletar(m: Modalidade) {
    const { count } = await supabase.from('matriculas').select('id', { count: 'exact', head: true }).eq('tipo', m.nome)
    if ((count ?? 0) > 0) {
      return alert(`Há ${count} matrícula(s) de alunos nesta modalidade. Para ela sumir do cadastro, deixe-a inativa em vez de excluir.`)
    }
    if (!confirm(`Excluir a modalidade ${m.nome}?`)) return
    const { error } = await supabase.from('modalidades').delete().eq('id', m.id)
    if (error) return alert(mensagemDeErro(error))
    carregar()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-page-title text-gray-900 mb-2">Modalidades</h1>
      <p className="text-sm text-gray-500 mb-6">
        Só as modalidades ativas aparecem no cadastro do aluno. Ao inativar, as matrículas que os alunos já têm continuam guardadas.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-sm"
            placeholder="Nome da modalidade (ex: Day Use, Torneio...)"
            onKeyDown={e => e.key === 'Enter' && adicionar()}
          />
          <button onClick={adicionar} className="h-10 px-4 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a]">
            + Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhuma modalidade cadastrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-th text-gray-500">Modalidade</th>
                <th className="text-left px-4 py-3 text-th text-gray-500 w-32">Ativa</th>
                <th className="text-left px-4 py-3 text-th text-gray-500 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(m => (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    {m.nome === 'Aula' ? 'Aula (aparece como "Aulas")' : m.nome}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={m.ativo} onChange={() => alternar(m)} />
                        <div className={`w-9 h-5 rounded-full transition-colors ${m.ativo ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${m.ativo ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <span className={`text-xs font-medium ${m.ativo ? 'text-green-700' : 'text-gray-500'}`}>{m.ativo ? 'Ativa' : 'Inativa'}</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {!FIXAS.includes(m.nome) && (
                      <button onClick={() => deletar(m)} className="text-red-600 hover:text-red-800" title="Excluir"><Trash2 size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
