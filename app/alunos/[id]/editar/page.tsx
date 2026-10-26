'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import EsportesForm from '@/components/alunos/EsportesForm'
import { carregarCatalogo, estadosDoAluno, salvarMatriculas, type Unidade } from '@/lib/esportes-db'
import type { EstadoEsporte, MatriculaBanco } from '@/lib/esportes'

function validarCPF(cpf: string) {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11) return false
  if (/^(\d)\1+$/.test(nums)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(nums[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(nums[10])) return false

  return true
}

export default function EditarAluno() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cpfValido, setCpfValido] = useState<boolean | null>(null)

  const [form, setForm] = useState({
    nome: '',
    celular: '',
    cpf: '',
    sexo: '',
    data_nascimento: '',
    data_cadastro: '',
    data_vencimento: '',
    observacao: '',
    status: 'Ativo',
    unidade_id: '',
  })

  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [estados, setEstados] = useState<EstadoEsporte[]>([])
  const [idsExistentes, setIdsExistentes] = useState<string[]>([])

  function mascaraCPF(v: string) {
    v = v.replace(/\D/g, '').slice(0, 11)
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3')
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2')
    return v
  }

  function mascaraCelular(v: string) {
    v = v.replace(/\D/g, '').slice(0, 11)
    if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
    return v
  }

  useEffect(() => {
    async function carregar() {
      const { data: a } = await supabase.from('alunos').select('*').eq('id', id).single()
      const { data: m } = await supabase.from('matriculas').select('*').eq('aluno_id', id)

      if (a) {
        setForm({
          nome: a.nome ?? '',
          celular: a.celular ?? '',
          cpf: a.cpf ?? '',
          sexo: a.sexo ?? '',
          data_nascimento: a.data_nascimento ?? '',
          data_cadastro: a.data_cadastro ?? '',
          data_vencimento: a.data_vencimento ?? '',
          observacao: a.observacao ?? '',
          status: a.status ?? 'Ativo',
          unidade_id: a.unidade_id ?? '',
        })
      }

      const { data: profs } = await supabase.from('professores').select('id, nome').eq('ativo', true).order('nome')
      setProfessores(profs ?? [])

      const { esportes, unidades: libs } = await carregarCatalogo(supabase)
      setUnidades(libs)
      const unidadePadrao = a?.unidade_id ?? libs[0]?.id ?? ''
      setIdsExistentes((m ?? []).map(x => x.id))
      setEstados(estadosDoAluno(esportes, (m ?? []) as MatriculaBanco[], unidadePadrao))

      setLoading(false)
    }
    carregar()
  }, [id])

  async function salvar() {
    if (!form.nome) return alert('Informe o nome do aluno')
    if (form.cpf && !validarCPF(form.cpf)) return alert('CPF inválido')
    setSaving(true)

    await supabase.from('alunos').update({ ...form, unidade_id: form.unidade_id || undefined }).eq('id', id)

    const erroMatriculas = await salvarMatriculas(supabase, id, estados, idsExistentes)
    if (erroMatriculas) {
      alert('Erro ao salvar as modalidades: ' + erroMatriculas)
      setSaving(false)
      return
    }

    await registrarLog('Editou aluno', 'alunos', id, form.nome)
    router.push('/alunos')
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-page-title text-gray-900">Editar aluno</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="text-th text-gray-400 mb-4">Dados pessoais</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-label text-gray-500 block mb-1">Nome completo</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome completo do aluno"
              value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label className="text-label text-gray-500 block mb-1">Celular</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="(00) 9 0000-0000"
              value={form.celular} onChange={e => setForm({ ...form, celular: mascaraCelular(e.target.value) })} />
          </div>
          <div>
            <label className="text-label text-gray-500 block mb-1">CPF</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="000.000.000-00"
              value={form.cpf} onChange={e => {
                const masked = mascaraCPF(e.target.value)
                setForm({ ...form, cpf: masked })
                if (masked.replace(/\D/g, '').length === 11) {
                  setCpfValido(validarCPF(masked))
                } else {
                  setCpfValido(null)
                }
              }} />
            {cpfValido === true && <p className="text-xs text-green-600 mt-1">✓ CPF válido</p>}
            {cpfValido === false && <p className="text-xs text-red-600 mt-1">✗ CPF inválido</p>}
          </div>
          <div>
            <label className="text-label text-gray-500 block mb-1">Sexo</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}>
              <option value="">Selecionar</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
          <div>
            <label className="text-label text-gray-500 block mb-1">Data de nascimento</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
          </div>
          <div>
            <label className="text-label text-gray-500 block mb-1">Data de cadastro</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.data_cadastro} onChange={e => setForm({ ...form, data_cadastro: e.target.value })} />
          </div>
          <div>
            <label className="text-label text-gray-500 block mb-1">Data de vencimento</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <div>
              <div className="text-label text-gray-500 mb-1">Status</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${form.status === 'Ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {form.status}
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600">Ativo</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={form.status === 'Ativo'}
                  onChange={e => setForm({ ...form, status: e.target.checked ? 'Ativo' : 'Inativo' })} />
                <div className={`w-9 h-5 rounded-full transition-colors ${form.status === 'Ativo' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.status === 'Ativo' ? 'translate-x-4' : ''}`}></div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="text-th text-gray-400 mb-4">Esportes e modalidades</div>
        {unidades.length > 1 && (
          <div className="mb-4">
            <label className="text-label text-gray-500 block mb-1">Unidade principal (a cobrança sai por ela)</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              value={form.unidade_id}
              onChange={e => setForm({ ...form, unidade_id: e.target.value })}
            >
              {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        )}
        <EsportesForm estados={estados} onChange={setEstados} unidades={unidades} professores={professores} />
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={salvar} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}