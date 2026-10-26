'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import { validarDadosAluno } from '@/lib/aluno-validacao'
import DadosPessoais, { cpfJaCadastrado, type FormAluno } from '@/components/alunos/DadosPessoais'
import EsportesForm from '@/components/alunos/EsportesForm'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { carregarCatalogo, estadosIniciais, salvarMatriculas } from '@/lib/esportes-db'
import type { EstadoEsporte } from '@/lib/esportes'

export default function NovoAluno() {
  const router = useRouter()
  const { unidade, unidadeId } = useUnidade()
  const [loading, setLoading] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [cpfDuplicado, setCpfDuplicado] = useState(false)
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([])
  const [estados, setEstados] = useState<EstadoEsporte[]>([])

  const [form, setForm] = useState<FormAluno>({
    nome: '',
    celular: '',
    cpf: '',
    sexo: '',
    data_nascimento: '',
    data_cadastro: new Date().toLocaleDateString('en-CA'),
    data_vencimento: '',
    observacao: '',
    status: 'Ativo',
  })

  useEffect(() => {
    supabase.from('professores').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => setProfessores(data ?? []))
    carregarCatalogo(supabase).then(({ esportes }) => setEstados(estadosIniciais(esportes, '')))
  }, [])

  const erros = validarDadosAluno(form, { cpfJaCadastrado: cpfDuplicado })

  async function salvar() {
    setTentou(true)
    if (!unidadeId) return alert('Seu login ainda não tem unidade liberada. Fale com quem administra o sistema.')
    // Confere o CPF de novo na hora de salvar (outra pessoa pode ter cadastrado enquanto isso)
    const duplicado = form.cpf ? await cpfJaCadastrado(form.cpf) : false
    setCpfDuplicado(duplicado)
    if (Object.keys(validarDadosAluno(form, { cpfJaCadastrado: duplicado })).length > 0) return

    setLoading(true)

    const { data: aluno, error } = await supabase
      .from('alunos')
      .insert({ ...form, unidade_id: unidadeId })
      .select()
      .single()

    if (error || !aluno) {
      alert('Erro ao salvar aluno: ' + error?.message)
      setLoading(false)
      return
    }

    const erroMatriculas = await salvarMatriculas(supabase, aluno.id, estados.map(e => ({ ...e, unidadeId })), [])
    if (erroMatriculas) alert('Aluno salvo, mas houve erro nas modalidades: ' + erroMatriculas)

    try {
      const asaasRes = await fetch('/api/asaas/criar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome, celular: form.celular, cpf: form.cpf, aluno_id: aluno.id })
      })
      const asaasData = await asaasRes.json()

      if (asaasData.id) {
        await supabase.from('alunos').update({ asaas_customer_id: asaasData.id }).eq('id', aluno.id)
      } else if (asaasData.error) {
        console.error('Erro Asaas:', asaasData.error)
        alert('Erro ao criar cliente Asaas: ' + asaasData.error)
      }
    } catch (e) {
      console.error('Erro na requisição Asaas:', e)
      alert('Erro ao criar cliente Asaas')
    }

    await registrarLog('Cadastrou aluno', 'alunos', aluno.id, form.nome)
    router.push('/alunos')
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-page-title text-gray-900">Novo aluno</h1>
        {unidade && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{unidade.nome}</span>}
      </div>

      <DadosPessoais form={form} onChange={setForm} erros={erros} mostrarErros={tentou} onCpfDuplicado={setCpfDuplicado} />

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="text-th text-gray-400 mb-3">Esportes e modalidades</div>
        <EsportesForm estados={estados} onChange={setEstados} professores={professores} />
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
