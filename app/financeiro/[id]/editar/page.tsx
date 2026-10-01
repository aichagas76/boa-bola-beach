'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Pessoa = { id: string; nome: string }
type ContaBancaria = { id: string; nome: string }
type AlunoRef = { id: string; nome: string }
type Professor = { id: string; nome: string }

export default function EditarMovimentacao() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categorias, setCategorias] = useState<any[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [alunos, setAlunos] = useState<AlunoRef[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])

  const [form, setForm] = useState({
    tipo: '' as 'Entrada' | 'Saída' | '',
    categoria_id: '',
    pessoa_id: '',
    aluno_ref_id: '',
    professor_id: '',
    conta_bancaria_id: '',
    status: '',
    data: '',
    data_vencimento: '',
    data_pagamento: '',
    descricao: '',
    valor: '',
    forma_pagamento: '',
  })

  function formatarValor(valor: string) {
    const numeros = valor.replace(/\D/g, '')
    if (!numeros) return ''
    const num = parseInt(numeros, 10)
    return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  useEffect(() => {
    if (!id) return

    async function carregar() {
      try {
        const { data: cats } = await supabase.from('categorias_financeiro').select('*').order('categoria')
        setCategorias(cats ?? [])

        const { data: pess } = await supabase.from('pessoas').select('*').order('nome')
        setPessoas(pess ?? [])

        const { data: cont } = await supabase.from('contas_bancarias').select('*').order('nome')
        setContas(cont ?? [])

        const { data: alns } = await supabase.from('alunos').select('id, nome').order('nome')
        setAlunos(alns ?? [])

        const { data: profs } = await supabase.from('professores').select('id, nome').order('nome')
        setProfessores(profs ?? [])

        const { data: movs } = await supabase.from('movimentacoes').select('*').eq('id', id)
        if (movs && movs.length > 0) {
          const mov = movs[0]
          setForm({
            tipo: mov.tipo ?? '',
            categoria_id: mov.categoria_id ?? '',
            pessoa_id: mov.pessoa_id ?? '',
            aluno_ref_id: mov.aluno_ref_id ?? '',
            professor_id: mov.professor_id ?? '',
            conta_bancaria_id: mov.conta_bancaria_id ?? '',
            status: mov.status ?? '',
            data: mov.data ?? '',
            data_vencimento: mov.data_vencimento ?? '',
            data_pagamento: mov.data_pagamento ?? '',
            descricao: mov.descricao ?? '',
            valor: mov.valor?.toString().replace(/\D/g, '') ?? '',
            forma_pagamento: mov.forma_pagamento ?? '',
          })
        }
      } catch (err) {
        console.error('Erro ao carregar:', err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [id])

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)
  const categoriasUnicas = [...new Set(categoriasFiltradas.map(c => c.categoria))]
  const categoriaSelecionada = categorias.find(c => c.id === form.categoria_id)
  const subcategorias = categoriasFiltradas.filter(c => c.categoria === categoriaSelecionada?.categoria && c.subcategoria)

  async function salvar() {
    if (!form.tipo || !form.data || !form.valor) return alert('Preencha tipo, data e valor')
    if (!form.data_vencimento) return alert('Informe a data de vencimento')
    if (!form.descricao) return alert('Informe a descrição')
    setSaving(true)
    const { error } = await supabase.from('movimentacoes').update({
      tipo: form.tipo,
      categoria_id: form.categoria_id || null,
      pessoa_id: form.pessoa_id || null,
      aluno_ref_id: form.aluno_ref_id || null,
      professor_id: form.professor_id || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      status: form.status || null,
      data: form.data,
      data_vencimento: form.data_vencimento || null,
      data_pagamento: form.data_pagamento || null,
      descricao: form.descricao || null,
      valor: parseFloat(form.valor.replace(/\D/g, '')) / 100,
      forma_pagamento: form.forma_pagamento || null,
    }).eq('id', id)
    if (error) { alert('Erro: ' + error.message); setSaving(false); return }
    router.push('/financeiro')
  }

  if (loading) return <div className="text-gray-400 text-sm p-6">Carregando...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-xl font-medium text-gray-900">Editar movimentação</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value as 'Entrada' | 'Saída', categoria_id: '' })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Selecionar</option>
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
              {categoriasUnicas.map(cat => {
                const item = categoriasFiltradas.find(c => c.categoria === cat && !c.subcategoria) || categoriasFiltradas.find(c => c.categoria === cat)
                return <option key={cat} value={item?.id}>{cat}</option>
              })}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Subcategoria (opcional)</label>
            <select
              value={subcategorias.find(s => s.id === form.categoria_id) ? form.categoria_id : ''}
              onChange={e => setForm({ ...form, categoria_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Nenhuma</option>
              {subcategorias.map(s => <option key={s.id} value={s.id}>{s.subcategoria}</option>)}
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
              {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
              {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
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
              {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
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
            <label className="text-xs text-gray-500 block mb-1">Forma de pagamento</label>
            <select
              value={form.forma_pagamento}
              onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Selecionar</option>
              <option value="Pix">Pix</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="Transferência">Transferência</option>
            </select>
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
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving} className="px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
