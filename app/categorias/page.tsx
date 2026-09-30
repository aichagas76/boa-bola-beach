'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2 } from 'lucide-react'

type CategoriaFinanceiro = {
  id: string
  tipo: 'Entrada' | 'Saída'
  categoria: string
  subcategoria: string | null
}

export default function Categorias() {
  const [tipo, setTipo] = useState<'Entrada' | 'Saída'>('Entrada')
  const [todasCategorias, setTodasCategorias] = useState<CategoriaFinanceiro[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('')
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novaSubcategoria, setNovaSubcategoria] = useState('')
  const [loading, setLoading] = useState(true)
  const [adicionandoCategoria, setAdicionandoCategoria] = useState(false)
  const [adicionandoSubcategoria, setAdicionandoSubcategoria] = useState(false)

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('categorias_financeiro')
      .select('*')
      .order('tipo, categoria, subcategoria')

    setTodasCategorias(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const categoriasFiltradas = Array.from(new Set(
    todasCategorias
      .filter(c => c.tipo === tipo && c.categoria)
      .map(c => c.categoria)
  ))

  const subcategoriasFiltradas = todasCategorias.filter(c =>
    c.tipo === tipo &&
    c.categoria === categoriaSelecionada &&
    c.subcategoria
  )

  async function adicionarCategoria() {
    if (!novaCategoria.trim()) return

    setAdicionandoCategoria(true)

    const { data, error } = await supabase
      .from('categorias_financeiro')
      .insert({
        tipo,
        categoria: novaCategoria,
        subcategoria: null,
      })
      .select()
      .single()

    if (error) {
      alert('Erro ao adicionar: ' + error.message)
      setAdicionandoCategoria(false)
      return
    }

    setTodasCategorias([...todasCategorias, data])
    setNovaCategoria('')
    setAdicionandoCategoria(false)
  }

  async function adicionarSubcategoria() {
    if (!novaSubcategoria.trim() || !categoriaSelecionada) return

    setAdicionandoSubcategoria(true)

    const { data, error } = await supabase
      .from('categorias_financeiro')
      .insert({
        tipo,
        categoria: categoriaSelecionada,
        subcategoria: novaSubcategoria,
      })
      .select()
      .single()

    if (error) {
      alert('Erro ao adicionar: ' + error.message)
      setAdicionandoSubcategoria(false)
      return
    }

    setTodasCategorias([...todasCategorias, data])
    setNovaSubcategoria('')
    setAdicionandoSubcategoria(false)
  }

  async function deletarCategoria(categoria: string) {
    if (!confirm(`Excluir categoria "${categoria}" e todas suas subcategorias?`)) return

    const { error } = await supabase
      .from('categorias_financeiro')
      .delete()
      .eq('tipo', tipo)
      .eq('categoria', categoria)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    setTodasCategorias(todasCategorias.filter(c => !(c.tipo === tipo && c.categoria === categoria)))
    if (categoriaSelecionada === categoria) setCategoriaSelecionada('')
  }

  async function deletarSubcategoria(subcategoria: string) {
    if (!confirm(`Excluir subcategoria "${subcategoria}"?`)) return

    const { error } = await supabase
      .from('categorias_financeiro')
      .delete()
      .eq('tipo', tipo)
      .eq('categoria', categoriaSelecionada)
      .eq('subcategoria', subcategoria)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    setTodasCategorias(todasCategorias.filter(c => !(c.tipo === tipo && c.categoria === categoriaSelecionada && c.subcategoria === subcategoria)))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Categorias</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SEÇÃO 1: TIPO */}
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

        {/* SEÇÃO 2: CATEGORIAS */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Categorias</div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {categoriasFiltradas.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4">Nenhuma categoria</div>
                ) : (
                  categoriasFiltradas.map(cat => (
                    <div
                      key={cat}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        categoriaSelecionada === cat
                          ? 'bg-[#7DC421] bg-opacity-20 border border-[#7DC421]'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setCategoriaSelecionada(cat)}
                    >
                      <span className="text-sm font-medium text-gray-900">{cat}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          deletarCategoria(cat)
                        }}
                        className="text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={novaCategoria}
                  onChange={e => setNovaCategoria(e.target.value)}
                  placeholder="Nova categoria"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                  onKeyPress={e => e.key === 'Enter' && adicionarCategoria()}
                />
                <button
                  onClick={adicionarCategoria}
                  disabled={adicionandoCategoria}
                  className="px-3 py-2 text-xs bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* SEÇÃO 3: SUBCATEGORIAS */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Subcategorias</div>

          {!categoriaSelecionada ? (
            <div className="text-xs text-gray-400 py-8 text-center">Selecione uma categoria</div>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {subcategoriasFiltradas.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4">Nenhuma subcategoria</div>
                ) : (
                  subcategoriasFiltradas.map(sub => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="text-sm text-gray-900">{sub.subcategoria}</span>
                      <button
                        onClick={() => deletarSubcategoria(sub.subcategoria!)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={novaSubcategoria}
                  onChange={e => setNovaSubcategoria(e.target.value)}
                  placeholder="Nova subcategoria"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                  onKeyPress={e => e.key === 'Enter' && adicionarSubcategoria()}
                />
                <button
                  onClick={adicionarSubcategoria}
                  disabled={adicionandoSubcategoria}
                  className="px-3 py-2 text-xs bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
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
