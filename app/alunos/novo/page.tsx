'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'

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

export default function NovoAluno() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cpfValido, setCpfValido] = useState<boolean | null>(null)
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([])

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
    v = v.replace(/\D/g, '')
    if (!v) return ''
    v = (parseInt(v) / 100).toFixed(2)
    return v.replace('.', ',')
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
    if (!form.nome) return alert('Informe o nome do aluno')
    if (form.cpf && !validarCPF(form.cpf)) return alert('CPF inválido')
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
        valor: parseFloat(valorClubinho.replace(',', '.')) || 0,
      })
    }

    if (aulas) {
      for (const a of aulasList) {
        await supabase.from('matriculas').insert({
          aluno_id: aluno.id,
          tipo: 'Aula',
          valor: parseFloat(a.valor.replace(',', '.')) || 0,
          professor_nome: a.professor || null,
        })
      }
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