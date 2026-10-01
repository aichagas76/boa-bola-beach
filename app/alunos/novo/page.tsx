'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import { useFormValidation } from '@/lib/hooks/useFormValidation'
import { FormInput, FormSelect, FormError } from '@/components/ui/form-error'
import { validarCPF, validarCelular, VALIDATION_MESSAGES } from '@/lib/validators'

export default function NovoAluno() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([])

  const rules = {
    nome: { required: true, minLength: 3, message: 'Nome deve ter no mínimo 3 caracteres' },
    cpf: {
      validate: (v: string) => !v || validarCPF(v) ? true : 'CPF inválido',
    },
    celular: {
      validate: (v: string) => !v || validarCelular(v) ? true : 'Celular inválido',
    },
    data_vencimento: { required: true, message: 'Data de vencimento é obrigatória' },
  }

  const validation = useFormValidation(rules)

  useEffect(() => {
    supabase.from('professores').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => setProfessores(data ?? []))
  }, [])

  const [form, setForm] = useState({
    nome: '',
    celular: '',
    cpf: '',
    sexo: '',
    data_nascimento: '',
    data_cadastro: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    endereco: '',
    observacao: '',
    status: 'Ativo',
  })

  const [clubinho, setClubinho] = useState(false)
  const [valorClubinho, setValorClubinho] = useState('')
  const [aulas, setAulas] = useState(false)
  const [aulasList, setAulasList] = useState([{ professor: '', valor: '' }])

  function mascaraCPF(v: string) {
    v = v.replace(/\D/g, '').slice(0, 11)
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3')
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2')
    return v
  }

  function mascaraValor(v: string) {
    let num = v.replace(/\D/g, '')
    if (!num) return ''
    return 'R$ ' + parseInt(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function mascaraCelular(v: string) {
    v = v.replace(/\D/g, '').slice(0, 11)
    if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
    return v
  }

  function addAula() {
    if (aulasList.length < 2) setAulasList([...aulasList, { professor: '', valor: '' }])
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
    if (!validation.validate(form)) return

    setLoading(true)

    const { data: aluno, error } = await supabase
      .from('alunos')
      .insert(form)
      .select()
      .single()

    if (error || !aluno) {
      alert('Erro ao salvar aluno: ' + error?.message)
      setLoading(false)
      return
    }

    if (clubinho) {
      await supabase.from('matriculas').insert({
        aluno_id: aluno.id,
        tipo: 'Clubinho',
        valor: parseFloat(valorClubinho.replace(/\D/g, '')) || 0,
      })
    }

    if (aulas) {
      for (const a of aulasList) {
        await supabase.from('matriculas').insert({
          aluno_id: aluno.id,
          tipo: 'Aula',
          valor: parseFloat(a.valor.replace(/\D/g, '')) || 0,
          professor_nome: a.professor || null,
        })
      }
    }

    try {
      console.log('📤 Criando cliente Asaas...', { nome: form.nome, cpf: form.cpf })
      const asaasRes = await fetch('/api/asaas/criar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome, celular: form.celular, cpf: form.cpf, aluno_id: aluno.id })
      })
      const asaasData = await asaasRes.json()
      console.log('📥 Resposta Asaas:', asaasData)

      if (asaasData.id) {
        console.log('✅ Cliente criado! ID:', asaasData.id)
        await supabase.from('alunos').update({ asaas_customer_id: asaasData.id }).eq('id', aluno.id)
      } else if (asaasData.error) {
        console.error('❌ Erro Asaas:', asaasData.error)
        alert('Erro ao criar cliente Asaas: ' + asaasData.error)
      }
    } catch (e) {
      console.error('❌ Erro na requisição Asaas:', e)
      alert('Erro ao criar cliente Asaas')
    }

    await registrarLog('Cadastrou aluno', 'alunos', aluno.id, form.nome)
    router.push('/alunos')
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-xl font-medium text-gray-900">Novo aluno</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Dados pessoais</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormInput
              label="Nome completo"
              placeholder="Nome completo do aluno"
              value={form.nome}
              error={validation.getFieldError('nome')}
              touched={validation.touched.nome}
              onChange={e => {
                setForm({ ...form, nome: e.target.value })
                validation.handleChange('nome', e.target.value)
              }}
              onBlur={() => validation.handleBlur('nome')}
            />
          </div>
          <div>
            <FormInput
              label="Celular"
              placeholder="(00) 9 0000-0000"
              value={form.celular}
              error={validation.getFieldError('celular')}
              touched={validation.touched.celular}
              onChange={e => {
                const masked = mascaraCelular(e.target.value)
                setForm({ ...form, celular: masked })
                validation.handleChange('celular', masked)
              }}
              onBlur={() => validation.handleBlur('celular')}
            />
          </div>
          <div>
            <FormInput
              label="CPF"
              placeholder="000.000.000-00"
              value={form.cpf}
              error={validation.getFieldError('cpf')}
              touched={validation.touched.cpf}
              onChange={e => {
                const masked = mascaraCPF(e.target.value)
                setForm({ ...form, cpf: masked })
                validation.handleChange('cpf', masked)
              }}
              onBlur={() => validation.handleBlur('cpf')}
            />
          </div>
          <div>
            <FormSelect
              label="Sexo"
              value={form.sexo}
              onChange={e => setForm({ ...form, sexo: e.target.value })}
            >
              <option value="">Selecionar</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </FormSelect>
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
            <FormInput
              type="date"
              label="Data de vencimento"
              value={form.data_vencimento}
              error={validation.getFieldError('data_vencimento')}
              touched={validation.touched.data_vencimento}
              onChange={e => {
                setForm({ ...form, data_vencimento: e.target.value })
                validation.handleChange('data_vencimento', e.target.value)
              }}
              onBlur={() => validation.handleBlur('data_vencimento')}
            />
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
              value={valorClubinho} onChange={e => setValorClubinho(mascaraValor(e.target.value))} />
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
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      value={aula.professor} onChange={e => updateAula(i, 'professor', e.target.value)}>
                      <option value="">Selecionar professor</option>
                      {professores.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Valor mensal</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="180,00"
                      value={aula.valor} onChange={e => updateAula(i, 'valor', mascaraValor(e.target.value))} />
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
        <button onClick={salvar} disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Salvando...' : 'Salvar aluno'}
        </button>
      </div>
    </div>
  )
}