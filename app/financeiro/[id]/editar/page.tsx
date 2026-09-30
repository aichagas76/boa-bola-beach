'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type CategoriaFinanceiro = {
  id: string
  tipo: 'Entrada' | 'Saída'
  categoria: string
  subcategoria: string | null
}

export default function EditarFinanceiro() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [todasCategorias, setTodasCategorias] = useState<CategoriaFinanceiro[]>([])

  const [form, setForm] = useState({
    tipo: 'Entrada' as 'Entrada' | 'Saída',
    categoria_id: '',
    data: '',
    descricao: '',
    valor: '',
    forma_pagamento: 'Pix',
  })

  useEffect(() => {
    async function carregarDados() {
      const [{ data: mov }, { data: cats }] = await Promise.all([
        supabase.from('movimentacoes').select('*').eq('id', id).single(),
        supabase.from('categorias_financeiro').select('*').order('tipo, categoria, subcategoria'),
      ])

      if (mov) {
        setForm({
          tipo: mov.tipo,
          categoria_id: mov.categoria_id,
          data: mov.data,
          descricao: mov.descricao || '',
          valor: mov.valor.toString(),
          forma_pagamento: mov.forma_pagamento,
        })
      }

      setTodasCategorias(cats ?? [])
      setCarregando(false)
    }
    carregarDados()
  }, [id])

  const categoriasUnicas = Array.from(new Map(
    todasCategorias
      .filter(c => c.tipo === form.tipo)
      .filter(c => !c.subcategoria)
      .map(c => [c.categoria, c])
  ).values())

  const categoriaSelecionada = todasCategorias.find(c => c.id === form.categoria_id)
  const subcategoriasDA = categoriaSelecionada
    ? todasCategorias.filter(c =>
        c.tipo === form.tipo &&
        c.categoria === categoriaSelecionada.categoria &&
        c.subcategoria
      )
    : []

  async function salvar() {
    if (!form.tipo) {
      alert('Selecione o tipo (Entrada/Saída)')
      return
    }

    if (!form.categoria_id || !form.valor) {
      alert('Preencha categoria e valor')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('movimentacoes')
      .update({
        tipo: form.tipo,
        categoria_id: form.categoria_id,
        data: form.data,
        descricao: form.descricao || null,
        valor: parseFloat(form.valor.replace(',', '.')),
        forma_pagamento: form.forma_pagamento,
      })
      .eq('id', id)

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setLoading(false)
      return
    }

    router.push('/financeiro')
  }

  if (carregando) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-xl font-medium text-gray-900">Editar Movimentação</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value as 'Entrada' | 'Saída', categoria_id: '' })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="Entrada">Entrada</option>
              <option value="Saída">Saída</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Categoria</label>
            <select
              value={form.categoria_id}
              onChange={e => setForm({ ...form, categoria_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Selecionar</option>
              {categoriasUnicas.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.categoria}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Subcategoria (opcional)</label>
            <select
              value={form.categoria_id && subcategoriasDA.some(s => s.id === form.categoria_id) ? form.categoria_id : ''}
              onChange={e => e.target.value && setForm({ ...form, categoria_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              disabled={subcategoriasDA.length === 0}
            >
              <option value="">Nenhuma</option>
              {subcategoriasDA.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.subcategoria}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm({ ...form, data: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Descrição (opcional)</label>
            <input
              type="text"
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder="Digite uma descrição"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Valor</label>
            <input
              type="text"
              value={form.valor}
              onChange={e => setForm({ ...form, valor: e.target.value })}
              placeholder="0,00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Forma de Pagamento</label>
            <select
              value={form.forma_pagamento}
              onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="Pix">Pix</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="Transferência">Transferência</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={loading}
          className="px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
