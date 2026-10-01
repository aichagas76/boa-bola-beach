'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EditarAluno() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
  })

  const [clubinho, setClubinho] = useState(false)
  const [valorClubinho, setValorClubinho] = useState('')
  const [matriculaClubinhoId, setMatriculaClubinhoId] = useState<string | null>(null)

  const [aulas, setAulas] = useState(false)
  const [aulasList, setAulasList] = useState<{ id: string | null, professor: string, valor: string }[]>([{ id: null, professor: '', valor: '' }])

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
        })
      }

      if (m) {
        const c = m.find(x => x.tipo === 'Clubinho')
        if (c) {
          setClubinho(true)
          setValorClubinho(c.valor?.toString().replace('.', ',') ?? '')
          setMatriculaClubinhoId(c.id)
        }

        const al = m.filter(x => x.tipo === 'Aula')
        if (al.length > 0) {
          setAulas(true)
          setAulasList(al.map(x => ({ id: x.id, professor: x.professor_nome ?? '', valor: x.valor?.toString().replace('.', ',') ?? '' })))
        }
      }

      setLoading(false)
    }
    carregar()
  }, [id])

  function addAula() {
    if (aulasList.length < 2) setAulasList([...aulasList, { id: null, professor: '', valor: '' }])
  }

  function removeAula(i: number) {
    setAulasList(aulasList.filter((_, idx) => idx !== i))
  }

  function updateAula(i: number, field: string, value: string) {
    const nova = [...aulasList]
    nova[i] = { ...nova[i], [field]: value }
    setAulasList(nova)
  }

  async function salvar() {
    if (!form.nome) return alert('Informe o nome do aluno')
    setSaving(true)

    await supabase.from('alunos').update(form).eq('id', id)

    // Clubinho
    if (clubinho) {
      if (matriculaClubinhoId) {
        await supabase.from('matriculas').update({ valor: parseFloat(valorClubinho.replace(',', '.')) || 0 }).eq('id', matriculaClubinhoId)
      } else {
        await supabase.from('matriculas').insert({ aluno_id: id, tipo: 'Clubinho', valor: parseFloat(valorClubinho.replace(',', '.')) || 0 })
      }
    } else if (matriculaClubinhoId) {
      await supabase.from('matriculas').delete().eq('id', matriculaClubinhoId)
    }

    // Aulas
    const aulasAntigas = aulasList.filter(a => a.id)
    const aulasNovas = aulasList.filter(a => !a.id)

    if (aulas) {
      for (const a of aulasAntigas) {
        await supabase.from('matriculas').update({ valor: parseFloat(a.valor.replace(',', '.')) || 0, professor_nome: a.professor || null }).eq('id', a.id!)
      }
      for (const a of aulasNovas) {
        await supabase.from('matriculas').insert({ aluno_id: id, tipo: 'Aula', valor: parseFloat(a.valor.replace(',', '.')) || 0, professor_nome: a.professor || null })
      }
    } else {
      for (const a of aulasAntigas) {
        await supabase.from('matriculas').delete().eq('id', a.id!)
      }
    }

    router.push(`/alunos/${id}`)
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-xl font-medium text-gray-900">Editar aluno</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Dados pessoais</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Nome completo</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome completo do aluno"
              value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Celular</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="(00) 9 0000-0000"
              value={form.celular} onChange={e => setForm({ ...form, celular: mascaraCelular(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">CPF</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="000.000.000-00"
              value={form.cpf} onChange={e => setForm({ ...form, cpf: mascaraCPF(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sexo</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}>
              <option value="">Selecionar</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Data de nascimento</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Data de cadastro</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.data_cadastro} onChange={e => setForm({ ...form, data_cadastro: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Data de vencimento</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-1">Status</div>
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
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Modalidades</div>

        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-900">🏆 Clubinho</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={clubinho} onChange={e => setClubinho(e.target.checked)} />
              <div className={`w-9 h-5 rounded-full transition-colors ${clubinho ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${clubinho ? 'translate-x-4' : ''}`}></div>
            </div>
          </label>
        </div>
        {clubinho && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <label className="text-xs text-gray-500 block mb-1">Valor mensal</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="150,00"
              value={valorClubinho} onChange={e => setValorClubinho(e.target.value)} />
          </div>
        )}

        <div className="flex items-center justify-between py-3 mt-2">
          <span className="text-sm font-medium text-gray-900">🎓 Aulas</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={aulas} onChange={e => setAulas(e.target.checked)} />
              <div className={`w-9 h-5 rounded-full transition-colors ${aulas ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${aulas ? 'translate-x-4' : ''}`}></div>
            </div>
          </label>
        </div>
        {aulas && (
          <div className="space-y-3 mt-1">
            {aulasList.map((aula, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg relative">
                <div className="text-xs font-medium text-gray-400 uppercase mb-3">Aula {i + 1}</div>
                {i > 0 && (
                  <button onClick={() => removeAula(i)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs">✕</button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Professor</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Nome do professor"
                      value={aula.professor} onChange={e => updateAula(i, 'professor', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Valor mensal</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="180,00"
                      value={aula.valor} onChange={e => updateAula(i, 'valor', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            {aulasList.length < 2 && (
              <button onClick={addAula} className="w-full border border-dashed border-blue-300 text-blue-600 text-sm py-2 rounded-lg hover:bg-blue-50">
                + Adicionar outra aula
              </button>
            )}
          </div>
        )}
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