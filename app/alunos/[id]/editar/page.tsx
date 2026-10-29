'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/log'
import { validarDadosAluno } from '@/lib/aluno-validacao'
import { paraBanco } from '@/lib/responsavel'
import DadosPessoais, { ChaveStatus, nomeJaCadastrado, type FormAluno } from '@/components/alunos/DadosPessoais'
import EsportesForm from '@/components/alunos/EsportesForm'
import { carregarCatalogo, estadosDoAluno, salvarMatriculas } from '@/lib/esportes-db'
import { idsEditaveisPorEsporte, type EstadoEsporte, type MatriculaBanco } from '@/lib/esportes'
import { carregarProfessoresAtivos, type ProfessorOpcao } from '@/lib/professores'
import { avisar } from '@/lib/avisos-ui'

const dadosParaValidar = (f: FormAluno) => ({ ...f, temResponsavel: f.tem_responsavel })

export default function EditarAluno() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [nomeDuplicado, setNomeDuplicado] = useState(false)
  const [nomeUnidade, setNomeUnidade] = useState('')

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
    motivo_inativacao_id: '',
    tem_responsavel: false,
    responsavel_nome: '',
    responsavel_cpf: '',
    responsavel_celular: '',
  })
  const [statusOriginal, setStatusOriginal] = useState('Ativo')
  const [motivos, setMotivos] = useState<{ id: string; nome: string }[]>([])
  const [professores, setProfessores] = useState<ProfessorOpcao[]>([])
  const [estados, setEstados] = useState<EstadoEsporte[]>([])
  const [modalidadesPorEsporte, setModalidadesPorEsporte] = useState<Record<string, string[]>>({})
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
          motivo_inativacao_id: a.motivo_inativacao_id ?? '',
          tem_responsavel: !!a.responsavel_nome,
          responsavel_nome: a.responsavel_nome ?? '',
          responsavel_cpf: a.responsavel_cpf ?? '',
          responsavel_celular: a.responsavel_celular ?? '',
        })
      }

      setProfessores(await carregarProfessoresAtivos(supabase))
      setStatusOriginal(a?.status ?? 'Ativo')
      const { data: mot } = await supabase.from('motivos_inativacao').select('id, nome, ativo').order('nome')
      setMotivos((mot ?? []).filter(x => x.ativo || x.id === a?.motivo_inativacao_id))

      const { esportes, unidades, modalidades: ativas, modalidadesPorEsporte: porEsporte } = await carregarCatalogo(supabase)
      setModalidadesPorEsporte(porEsporte)
      const unidadePadrao = a?.unidade_id ?? unidades[0]?.id ?? ''
      setNomeUnidade(unidades.find(u => u.id === a?.unidade_id)?.nome ?? '')
      // Matrícula de modalidade inativa (ou que não vale para o esporte) fica escondida e intocada: não é apagada ao salvar
      setIdsExistentes(idsEditaveisPorEsporte(m ?? [], porEsporte))
      setEstados(estadosDoAluno(esportes, (m ?? []) as MatriculaBanco[], unidadePadrao, ativas))

      setLoading(false)
    }
    carregar()
  }, [id])

  const erros = validarDadosAluno(dadosParaValidar(form), { nomeJaCadastrado: nomeDuplicado })
  // Inativar exige o motivo (quem já estava inativo antes do cadastro de motivos pode seguir sem)
  const inativando = form.status === 'Inativo' && statusOriginal !== 'Inativo'
  const faltaMotivo = inativando && !form.motivo_inativacao_id

  async function salvar() {
    setTentou(true)
    if (faltaMotivo) return avisar('Escolha o motivo da inativação do aluno.')
    const duplicado = await nomeJaCadastrado(form.nome, id)
    setNomeDuplicado(duplicado)
    if (Object.keys(validarDadosAluno(dadosParaValidar(form), { nomeJaCadastrado: duplicado })).length > 0) return

    setSaving(true)

    const { error } = await supabase.from('alunos').update({ ...paraBanco(form), motivo_inativacao_id: form.status === 'Inativo' ? form.motivo_inativacao_id || null : null }).eq('id', id)
    if (error) {
      avisar(error.code === '23505' ? 'Já existe um aluno com este nome.' : 'Erro ao salvar aluno: ' + error.message)
      setSaving(false)
      return
    }

    const erroMatriculas = await salvarMatriculas(supabase, id, estados, idsExistentes)
    if (erroMatriculas) {
      avisar('Erro ao salvar as modalidades: ' + erroMatriculas)
      setSaving(false)
      return
    }

    await registrarLog('Editou aluno', 'alunos', id, form.nome)
    router.push('/alunos')
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-4 pl-12 md:pl-0">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 shrink-0">
            <ArrowLeft size={16} /> Voltar
          </button>
          <span className="h-7 w-px bg-gray-200" />
          <h1 className="text-page-title text-blue-950 truncate">Editar aluno</h1>
          {nomeUnidade && <span className="text-sm text-gray-500 shrink-0">{nomeUnidade}</span>}
        </div>
        <ChaveStatus status={form.status} onChange={status => setForm({ ...form, status })} />
      </div>

      {form.status === 'Inativo' && (
        <div className={`mb-4 rounded-xl border bg-white p-4 ${tentou && faltaMotivo ? 'border-red-300' : 'border-gray-200'}`}>
          <label className="text-sm text-gray-700 block mb-1">Motivo da inativação{inativando ? ' *' : ''}</label>
          <select value={form.motivo_inativacao_id} onChange={e => setForm({ ...form, motivo_inativacao_id: e.target.value })}
            className="w-full max-w-sm h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white">
            <option value="">Selecione o motivo...</option>
            {motivos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {tentou && faltaMotivo && <div className="text-xs text-red-600 mt-1">Escolha o motivo para inativar o aluno.</div>}
          <div className="text-xs text-gray-500 mt-1">Os motivos são cadastrados em Cadastros → Motivos de inativação.</div>
        </div>
      )}

      <DadosPessoais form={form} onChange={setForm} erros={erros} mostrarErros={tentou} alunoId={id} onNomeDuplicado={setNomeDuplicado} />

      <EsportesForm estados={estados} onChange={setEstados} professores={professores} modalidadesPorEsporte={modalidadesPorEsporte} />

      <div className="flex justify-end gap-3">
        <button onClick={() => router.back()} className="h-10 px-5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={salvar} disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Check size={16} /> {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
