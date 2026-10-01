'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'

type CategoriaFinanceiro = {
  id: string
  tipo: 'Entrada' | 'Saída'
  categoria: string
  subcategoria: string | null
}

type Pessoa = { id: string; nome: string }
type ContaBancaria = { id: string; nome: string }
type AlunoRef = { id: string; nome: string }
type Professor = { id: string; nome: string }

export default function NovoFinanceiro() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [todasCategorias, setTodasCategorias] = useState<CategoriaFinanceiro[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [alunos, setAlunos] = useState<AlunoRef[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])

  const [form, setForm] = useState({
    tipo: 'Entrada' as 'Entrada' | 'Saída',
    categoria_id: '',
    pessoa_id: '',
    aluno_ref_id: '',
    professor_id: '',
    conta_bancaria_id: '',
    status: 'Não recebido' as 'Recebido' | 'Não recebido' | 'Pago' | 'Pendente',
    data: new Date().toLocaleDateString('en-CA'),
    data_vencimento: '',
    data_pagamento: '',
    descricao: '',
    valor: '',
    forma_pagamento: 'Pix',
  })

  function formatarValor(valor: string) {
    const numeros = valor.replace(/\D/g, '')
    if (!numeros) return ''
    const num = parseInt(numeros, 10)
    return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  useEffect(() => {
    async function carregar() {
      const { data: cats } = await supabase.from('categorias_financeiro').select('*')
      setTodasCategorias(cats ?? [])

      const { data: pess } = await supabase.from('pessoas').select('*').order('nome')
      setPessoas(pess ?? [])

      const { data: cont } = await supabase.from('contas_bancarias').select('*').order('nome')
      setContas(cont ?? [])

      const { data: alns } = await supabase.from('alunos').select('id, nome').order('nome')
      setAlunos(alns ?? [])

      const { data: profs } = await supabase.from('professores').select('id, nome').order('nome')
      setProfessores(profs ?? [])
    }
    carregar()
  }, [])

  useEffect(() => {
    setForm(f => ({
      ...f,
      status: form.tipo === 'Entrada' ? 'Não recebido' : 'Pendente'
    }))
  }, [form.tipo])

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
    if (!form.tipo || !form.categoria_id || !form.valor) {
      alert('Preencha tipo, categoria e valor')
      return
    }

    if (!form.data_vencimento) {
      alert('Informe a data de vencimento')
      return
    }

    if (!form.descricao) {
      alert('Informe a descrição')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('movimentacoes').insert({
      tipo: form.tipo,
      categoria_id: form.categoria_id,
      pessoa_id: form.pessoa_id || null,
      aluno_ref_id: form.aluno_ref_id || null,
      professor_id: form.professor_id || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      status: form.status,
      data: form.data,
      data_vencimento: form.data_vencimento || null,
      data_pagamento: form.data_pagamento || null,
      descricao: form.descricao || null,
      valor: parseFloat(form.valor.replace(/\D/g, '')) / 100,
      forma_pagamento: form.forma_pagamento,
    })

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setLoading(false)
      return
    }

    await registrarLog('Nova movimentação', 'movimentacoes', undefined, form.descricao)
    router.push('/financeiro')
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-xl font-medium text-gray-900">Nova Movimentação</h1>
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
            <label className="text-xs text-gray-500 block mb-1">{form.tipo === 'Entrada' ? 'Cliente' : 'Fornecedor'}</label>
            <select
              value={form.pessoa_id}
              onChange={e => setForm({ ...form, pessoa_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Nenhum</option>
              {pessoas.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Aluno (opcional)</label>
            <select
              value={form.aluno_ref_id}
              onChange={e => setForm({ ...form, aluno_ref_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Nenhum</option>
              {alunos.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Professor (opcional)</label>
            <select
              value={form.professor_id}
              onChange={e => setForm({ ...form, professor_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Nenhum</option>
              {professores.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Conta bancária (opcional)</label>
            <select
              value={form.conta_bancaria_id}
              onChange={e => setForm({ ...form, conta_bancaria_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Nenhuma</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <div className="flex gap-2">
              {form.tipo === 'Entrada' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'Recebido' })}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium ${
                      form.status === 'Recebido'
                        ? 'bg-[#7DC421] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Recebido
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'Não recebido' })}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium ${
                      form.status === 'Não recebido'
                        ? 'bg-[#7DC421] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Não recebido
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'Pago' })}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium ${
                      form.status === 'Pago'
                        ? 'bg-[#7DC421] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'Pendente' })}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium ${
                      form.status === 'Pendente'
                        ? 'bg-[#7DC421] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Pendente
                  </button>
                </>
              )}
            </div>
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

          <div>
            <label className="text-xs text-gray-500 block mb-1">Data de vencimento</label>
            <input
              type="date"
              value={form.data_vencimento}
              onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Data de pagamento (opcional)</label>
            <input
              type="date"
              value={form.data_pagamento}
              onChange={e => setForm({ ...form, data_pagamento: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Descrição</label>
            <input
              type="text"
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder="Digite uma descrição"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Valor</label>
            <input
              type="text"
              value={form.valor ? `R$ ${formatarValor(form.valor)}` : ''}
              onChange={e => setForm({ ...form, valor: e.target.value.replace(/\D/g, '') })}
              placeholder="R$ 0,00"
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
