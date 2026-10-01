'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, Edit2, Check, X } from 'lucide-react'
import { usePagination } from '@/lib/hooks/usePagination'
import { Pagination } from '@/components/ui/pagination'

type Professor = {
  id: string
  nome: string
  celular: string | null
  comissao_percentual: number | null
}

type FormState = {
  nome: string
  celular: string
  comissao_percentual: string
}

const formVazio: FormState = { nome: '', celular: '', comissao_percentual: '' }

function mascaraCelular(v: string) {
  v = v.replace(/\D/g, '').slice(0, 11)
  if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
  else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  return v
}

export default function Professores() {
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(formVazio)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [mostraForm, setMostraForm] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('professores').select('*').order('nome')
    setProfessores(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  function iniciarNovo() {
    setForm(formVazio)
    setEditandoId(null)
    setMostraForm(true)
  }

  function iniciarEditar(p: Professor) {
    setForm({
      nome: p.nome,
      celular: p.celular ?? '',
      comissao_percentual: p.comissao_percentual?.toString() ?? '',
    })
    setEditandoId(p.id)
    setMostraForm(true)
  }

  function cancelar() {
    setMostraForm(false)
    setEditandoId(null)
    setForm(formVazio)
  }

  async function salvar() {
    if (!form.nome.trim()) return alert('Informe o nome do professor')
    const comissao = form.comissao_percentual ? parseFloat(form.comissao_percentual) : null
    if (comissao !== null && (comissao < 0 || comissao > 100)) return alert('Comissão deve ser entre 0 e 100')

    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      celular: form.celular || null,
      comissao_percentual: comissao,
    }

    if (editandoId) {
      const { error } = await supabase.from('professores').update(payload).eq('id', editandoId)
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('professores').insert(payload)
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return }
    }

    setSalvando(false)
    cancelar()
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este professor?')) return
    const { error } = await supabase.from('professores').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    carregar()
  }

  const pagination = usePagination(professores, 15)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Professores</h1>
        {!mostraForm && (
          <button
            onClick={iniciarNovo}
            className="px-4 py-2.5 text-sm bg-[#7DC421] text-white font-medium rounded-lg hover:bg-[#6ab01a] transition-colors"
          >
            + Novo professor
          </button>
        )}
      </div>

      {mostraForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="text-sm font-medium text-gray-700 mb-4">
            {editandoId ? 'Editar professor' : 'Novo professor'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nome <span className="text-red-500">*</span></label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Celular</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="(00) 00000-0000"
                value={form.celular}
                onChange={e => setForm({ ...form, celular: mascaraCelular(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Comissão (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: 30"
                value={form.comissao_percentual}
                onChange={e => setForm({ ...form, comissao_percentual: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancelar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Celular</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Comissão %</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Carregando...</td></tr>
              )}
              {!loading && professores.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhum professor cadastrado.</td></tr>
              )}
              {pagination.paginatedItems.map((p, i) => (
                <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === pagination.paginatedItems.length - 1 && pagination.currentPage === pagination.totalPages ? 'border-0' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                <td className="px-4 py-3 text-gray-600">{p.celular ? mascaraCelular(p.celular) : '-'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {p.comissao_percentual != null ? `${p.comissao_percentual}%` : '-'}
                </td>
                <td className="px-4 py-3 flex gap-3 justify-end">
                  <button onClick={() => iniciarEditar(p)} className="text-blue-600 hover:text-blue-800">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => excluir(p.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
        />
      </div>
    </div>
  )
}
