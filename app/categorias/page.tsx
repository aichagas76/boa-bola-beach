'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, Edit2, Check, X } from 'lucide-react'

type CategoriaFinanceiro = {
  id: string
  tipo: 'Entrada' | 'Saída'
  categoria: string
  subcategoria: string | null
}

export default function Categorias() {
  const [tipo, setTipo] = useState<'Entrada' | 'Saída'>('Entrada')
  const [dados, setDados] = useState<CategoriaFinanceiro[]>([])
  const [loading, setLoading] = useState(true)

  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('')
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novaSubcategoria, setNovaSubcategoria] = useState('')

  const [editandoId, setEditandoId] = useState<string>('')
  const [editandoValor, setEditandoValor] = useState('')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('categorias_financeiro')
      .select('*')
      .order('tipo')
      .order('categoria')
      .order('subcategoria')

    setDados(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const categoriasFiltradas = Array.from(new Set(
    dados
      .filter(d => d.tipo === tipo && d.categoria && !d.subcategoria)
      .map(d => d.categoria)
  ))

  const subcategoriasFiltradas = dados.filter(d =>
    d.tipo === tipo &&
    d.categoria === categoriaSelecionada &&
    d.subcategoria
  )

  async function adicionarCategoria() {
    if (!novaCategoria.trim()) return

    const { error } = await supabase
      .from('categorias_financeiro')
      .insert({
        tipo,
        categoria: novaCategoria,
        subcategoria: null,
      })

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    setNovaCategoria('')
    carregar()
  }

  async function adicionarSubcategoria() {
    if (!novaSubcategoria.trim() || !categoriaSelecionada) return

    const { error } = await supabase
      .from('categorias_financeiro')
      .insert({
        tipo,
        categoria: categoriaSelecionada,
        subcategoria: novaSubcategoria,
      })

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    setNovaSubcategoria('')
    carregar()
  }

  async function editarItem(id: string, novoValor: string) {
    if (!novoValor.trim()) return

    const item = dados.find(d => d.id === id)
    if (!item) return

    const { error } = await supabase
      .from('categorias_financeiro')
      .update(
        item.subcategoria
          ? { subcategoria: novoValor }
          : { categoria: novoValor }
      )
      .eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    setEditandoId('')
    setEditandoValor('')
    carregar()
  }

  async function deletarItem(id: string) {
    if (!confirm('Excluir?')) return

    const { error } = await supabase
      .from('categorias_financeiro')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    carregar()
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Categorias</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLUNA 1: TIPO */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Tipo</div>
          <div className="space-y-2">
            <button
              onClick={() => {
                setTipo('Entrada')
                setCategoriaSelecionada('')
              }}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                tipo === 'Entrada'
                  ? 'bg-[#7DC421] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📥 Entrada
            </button>
            <button
              onClick={() => {
                setTipo('Saída')
                setCategoriaSelecionada('')
              }}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                tipo === 'Saída'
                  ? 'bg-[#7DC421] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📤 Saída
            </button>
          </div>
        </div>

        {/* COLUNA 2: CATEGORIAS */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Categorias</div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {categoriasFiltradas.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4">Nenhuma</div>
                ) : (
                  categoriasFiltradas.map(cat => {
                    const item = dados.find(d => d.tipo === tipo && d.categoria === cat && !d.subcategoria)
                    if (!item) return null

                    return (
                      <div key={item.id} className="flex items-center gap-2">
                        {editandoId === item.id ? (
                          <>
                            <input
                              type="text"
                              value={editandoValor}
                              onChange={e => setEditandoValor(e.target.value)}
                              className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                              autoFocus
                            />
                            <button
                              onClick={() => editarItem(item.id, editandoValor)}
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
                          </>
                        ) : (
                          <>
                            <span
                              onClick={() => setCategoriaSelecionada(cat)}
                              className={`flex-1 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
                                categoriaSelecionada === cat
                                  ? 'bg-[#7DC421] bg-opacity-20 border border-[#7DC421]'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              {cat}
                            </span>
                            <button
                              onClick={() => {
                                setEditandoId(item.id)
                                setEditandoValor(cat)
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deletarItem(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={novaCategoria}
                  onChange={e => setNovaCategoria(e.target.value)}
                  placeholder="Nova"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                  onKeyPress={e => e.key === 'Enter' && adicionarCategoria()}
                />
                <button
                  onClick={adicionarCategoria}
                  className="px-3 py-2 text-xs bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a]"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* COLUNA 3: SUBCATEGORIAS */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Subcategorias</div>

          {!categoriaSelecionada ? (
            <div className="text-xs text-gray-400 py-8 text-center">Selecione uma categoria</div>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {subcategoriasFiltradas.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4">Nenhuma</div>
                ) : (
                  subcategoriasFiltradas.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2">
                      {editandoId === sub.id ? (
                        <>
                          <input
                            type="text"
                            value={editandoValor}
                            onChange={e => setEditandoValor(e.target.value)}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                            autoFocus
                          />
                          <button
                            onClick={() => editarItem(sub.id, editandoValor)}
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
                        </>
                      ) : (
                        <>
                          <span className="flex-1 px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-900">
                            {sub.subcategoria}
                          </span>
                          <button
                            onClick={() => {
                              setEditandoId(sub.id)
                              setEditandoValor(sub.subcategoria || '')
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deletarItem(sub.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={novaSubcategoria}
                  onChange={e => setNovaSubcategoria(e.target.value)}
                  placeholder="Nova"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                  onKeyPress={e => e.key === 'Enter' && adicionarSubcategoria()}
                />
                <button
                  onClick={adicionarSubcategoria}
                  className="px-3 py-2 text-xs bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a]"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
