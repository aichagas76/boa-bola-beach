'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import { validarDadosAluno } from '@/lib/aluno-validacao'
import DadosPessoais, { nomeJaCadastrado, type FormAluno } from '@/components/alunos/DadosPessoais'
import EsportesForm from '@/components/alunos/EsportesForm'
import { carregarCatalogo, estadosDoAluno, salvarMatriculas } from '@/lib/esportes-db'
import type { EstadoEsporte, MatriculaBanco } from '@/lib/esportes'

export default function EditarAluno() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [nomeDuplicado, setNomeDuplicado] = useState(false)

  const [form, setForm] = useState<FormAluno>({
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
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([])
  const [estados, setEstados] = useState<EstadoEsporte[]>([])
  const [idsExistentes, setIdsExistentes] = useState<string[]>([])

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

      const { data: profs } = await supabase.from('professores').select('id, nome').eq('ativo', true).order('nome')
      setProfessores(profs ?? [])

      const { esportes, unidades } = await carregarCatalogo(supabase)
      const unidadePadrao = a?.unidade_id ?? unidades[0]?.id ?? ''
      setIdsExistentes((m ?? []).map(x => x.id))
      setEstados(estadosDoAluno(esportes, (m ?? []) as MatriculaBanco[], unidadePadrao))

      setLoading(false)
    }
    carregar()
  }, [id])

  const erros = validarDadosAluno(form, { nomeJaCadastrado: nomeDuplicado })

  async function salvar() {
    setTentou(true)
    const duplicado = await nomeJaCadastrado(form.nome, id)
    setNomeDuplicado(duplicado)
    if (Object.keys(validarDadosAluno(form, { nomeJaCadastrado: duplicado })).length > 0) return

    setSaving(true)

    const { error } = await supabase.from('alunos').update(form).eq('id', id)
    if (error) {
      alert(error.code === '23505' ? 'Já existe um aluno com este nome.' : 'Erro ao salvar aluno: ' + error.message)
      setSaving(false)
      return
    }

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
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
        <h1 className="text-page-title text-gray-900">Editar aluno</h1>
      </div>

      <DadosPessoais form={form} onChange={setForm} erros={erros} mostrarErros={tentou} alunoId={id} onNomeDuplicado={setNomeDuplicado} />

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="text-th text-gray-400 mb-3">Esportes e modalidades</div>
        <EsportesForm estados={estados} onChange={setEstados} professores={professores} />
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
