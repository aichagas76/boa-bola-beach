'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import { validarDadosAluno } from '@/lib/aluno-validacao'
import { pagador, paraBanco } from '@/lib/responsavel'
import DadosPessoais, { ChaveStatus, nomeJaCadastrado, type FormAluno } from '@/components/alunos/DadosPessoais'
import EsportesForm from '@/components/alunos/EsportesForm'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { carregarCatalogo, estadosIniciais, salvarMatriculas } from '@/lib/esportes-db'
import type { EstadoEsporte } from '@/lib/esportes'

const dadosParaValidar = (f: FormAluno) => ({ ...f, temResponsavel: f.tem_responsavel })

export default function NovoAluno() {
  const router = useRouter()
  const { unidade, unidadeId } = useUnidade()
  const [loading, setLoading] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [nomeDuplicado, setNomeDuplicado] = useState(false)
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([])
  const [estados, setEstados] = useState<EstadoEsporte[]>([])
  const [modalidades, setModalidades] = useState<string[]>([])

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
    tem_responsavel: false,
    responsavel_nome: '',
    responsavel_cpf: '',
    responsavel_celular: '',
  })

  useEffect(() => {
    supabase.from('professores').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => setProfessores(data ?? []))
    carregarCatalogo(supabase).then(({ esportes, modalidades }) => {
      setModalidades(modalidades)
      setEstados(estadosIniciais(esportes, '', modalidades))
    })
  }, [])

  const erros = validarDadosAluno(dadosParaValidar(form), { nomeJaCadastrado: nomeDuplicado })

  async function salvar() {
    setTentou(true)
    if (!unidadeId) return alert('Seu login ainda não tem unidade liberada. Fale com quem administra o sistema.')
    // Confere o nome de novo na hora de salvar (outra pessoa pode ter cadastrado enquanto isso)
    const duplicado = await nomeJaCadastrado(form.nome)
    setNomeDuplicado(duplicado)
    if (Object.keys(validarDadosAluno(dadosParaValidar(form), { nomeJaCadastrado: duplicado })).length > 0) return

    setLoading(true)

    const { data: aluno, error } = await supabase
      .from('alunos')
      .insert({ ...paraBanco(form), unidade_id: unidadeId })
      .select()
      .single()

    if (error || !aluno) {
      alert(error?.code === '23505' ? 'Já existe um aluno com este nome.' : 'Erro ao salvar aluno: ' + error?.message)
      setLoading(false)
      return
    }

    const erroMatriculas = await salvarMatriculas(supabase, aluno.id, estados.map(e => ({ ...e, unidadeId })), [])
    if (erroMatriculas) alert('Aluno salvo, mas houve erro nas modalidades: ' + erroMatriculas)

    try {
      const quemPaga = pagador({ nome: form.nome, cpf: form.cpf, celular: form.celular, responsavel_nome: form.tem_responsavel ? form.responsavel_nome : null, responsavel_cpf: form.responsavel_cpf, responsavel_celular: form.responsavel_celular })
      const asaasRes = await fetch('/api/asaas/criar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: quemPaga.nome, celular: quemPaga.celular, cpf: quemPaga.cpf, aluno_id: aluno.id })
      })
      const asaasData = await asaasRes.json()

      if (asaasData.id) {
        await supabase.from('alunos').update({ asaas_customer_id: asaasData.id, asaas_customer_doc: (quemPaga.cpf ?? '').replace(/\D/g, '') }).eq('id', aluno.id)
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
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-4 pl-12 md:pl-0">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 shrink-0">
            <ArrowLeft size={16} /> Voltar
          </button>
          <span className="h-7 w-px bg-gray-200" />
          <h1 className="text-page-title text-blue-950 truncate">Novo aluno</h1>
          {unidade && <span className="text-sm text-gray-500 shrink-0">{unidade.nome}</span>}
        </div>
        <ChaveStatus status={form.status} onChange={status => setForm({ ...form, status })} />
      </div>

      <DadosPessoais form={form} onChange={setForm} erros={erros} mostrarErros={tentou} onNomeDuplicado={setNomeDuplicado} />

      <EsportesForm estados={estados} onChange={setEstados} professores={professores} modalidades={modalidades} />

      <div className="flex justify-end gap-3">
        <button onClick={() => router.back()} className="h-10 px-5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={salvar} disabled={loading} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Check size={16} /> {loading ? 'Salvando...' : 'Salvar aluno'}
        </button>
      </div>
    </div>
  )
}
