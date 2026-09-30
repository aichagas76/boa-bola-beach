'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2 } from 'lucide-react'

type Categoria = {
  id: string
  tipo: 'Entrada' | 'Saída'
  nome: string
  criado_em: string
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [novaCategoria, setNovaCategoria] = useState({
    tipo: 'Entrada' as 'Entrada' | 'Saída',
    nome: '',
  })
  const [adicionando, setAdicionando] = useState(false)

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('categorias')
      .select('*')
      .order('tipo, nome')

    setCategorias(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar() {
    if (!novaCategoria.nome.trim()) {
      alert('Digite o nome da categoria')
      return
    }

    setAdicionando(true)

    const { data, error } = await supabase
      .from('categorias')
      .insert({ tipo: novaCategoria.tipo, nome: novaCategoria.nome })
      .select()
      .single()

    if (error) {
      alert('Erro ao adicionar: ' + error.message)
      setAdicionando(false)
      return
    }

    setCategorias([...categorias, data])
    setNovaCategoria({ tipo: 'Entrada', nome: '' })
    setAdicionando(false)
  }

  async function deletar(id: string) {
    if (!confirm('Excluir esta categoria?')) return

    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    setCategorias(categorias.filter(c => c.id !== id))
  }

  const categoriasEntrada = categorias.filter(c => c.tipo === 'Entrada')
  const categoriasSaida = categorias.filter(c => c.tipo === 'Saída')

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Categorias</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="text-sm font-semibold text-gray-900 mb-4">Adicionar Categoria</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={novaCategoria.tipo}
            onChange={e => setNovaCategoria({ ...novaCategoria, tipo: e.target.value as 'Entrada' | 'Saída' })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="Entrada">Entrada</option>
            <option value="Saída">Saída</option>
          </select>
          <input
            type="text"
            value={novaCategoria.nome}
            onChange={e => setNovaCategoria({ ...novaCategoria, nome: e.target.value })}
            placeholder="Nome da categoria"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            onKeyPress={e => e.key === 'Enter' && adicionar()}
          />
          <button
            onClick={adicionar}
            disabled={adicionando}
            className="px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
          >
            {adicionando ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-green-700 mb-4">📥 Entradas</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Criado em</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {categoriasEntrada.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-gray-400">Nenhuma categoria de entrada</td></tr>
                  ) : (
                    categoriasEntrada.map((c, i) => (
                      <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === categoriasEntrada.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deletar(c.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-red-700 mb-4">📤 Saídas</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Criado em</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {categoriasSaida.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-gray-400">Nenhuma categoria de saída</td></tr>
                  ) : (
                    categoriasSaida.map((c, i) => (
                      <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === categoriasSaida.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deletar(c.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
