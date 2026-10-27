'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { registrarLog } from '@/lib/log'
import Link from 'next/link'
import { usePagination } from '@/lib/hooks/usePagination'
import { Pagination } from '@/components/ui/pagination'
import IconeEsporte from '@/components/alunos/IconeEsporte'
import { ordenar, proximaOrdem, type Direcao, type Valor } from '@/lib/ordenacao'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import IconeModalidade from '@/components/alunos/IconeModalidade'
import { BadgeCheck, Copy, CircleDollarSign, CreditCard, History, Link2, Package, Pencil, Trash2, X } from 'lucide-react'
import { VendaDoAluno } from '@/components/estoque/FormVenda'
import HistoricoAluno from '@/components/alunos/HistoricoAluno'

type Aluno = {
  id: string
  nome: string
  celular: string
  cpf: string
  status: string
  data_vencimento: string
  valor_total: number
  esportesMod: { esporte: string; modalidades: string[] }[] // cada esporte do aluno e as modalidades dele nele
  professores_nomes: string
  ultimo_pagamento: string | null
  pago_mes: number
  parcial_mes: number
  asaas_customer_id: string | null
  combo?: boolean
  responsavel_nome?: string | null
  responsavel_cpf?: string | null
  responsavel_celular?: string | null
  link_pagamento: string | null
}

type Matricula = {
  id: string
  tipo: string
  valor: number
  professor_nome: string | null
  professor_id: string | null
}

type ColunaId = 'nome' | 'celular' | 'vencimento' | 'ultimo' | 'esporte' | 'professor' | 'valor' | 'parcial' | 'asaas' | 'link' | 'status'

// O que cada coluna usa para ordenar (vazio vai sempre para o fim)
const CHAVES: Record<ColunaId, (a: Aluno) => Valor> = {
  nome: a => a.nome,
  celular: a => (a.celular ?? '').replace(/\D/g, ''),
  vencimento: a => a.data_vencimento,
  ultimo: a => a.ultimo_pagamento,
  esporte: a => a.esportesMod[0]?.esporte ?? null,
  professor: a => (a.professores_nomes && a.professores_nomes !== '-' ? a.professores_nomes : null),
  valor: a => (a.valor_total > 0 ? a.valor_total : null),
  parcial: a => (a.parcial_mes > 0 ? a.parcial_mes : null),
  asaas: a => (a.asaas_customer_id ? 1 : 0),
  link: a => (a.link_pagamento ? 1 : 0),
  status: a => a.status,
}

// Cada esporte tem sempre a mesma posição na coluna Esporte (a bolinha fica alinhada de linha para linha)
const ORDEM_ESPORTES = ['Tênis', 'Beach Tênis', 'Pickleball', 'Padel']

type Alinha = 'left' | 'center' | 'right'
const ALINHA: Record<ColunaId, Alinha> = {
  nome: 'left', celular: 'left', vencimento: 'center', ultimo: 'center', esporte: 'left', professor: 'left',
  valor: 'right', parcial: 'right', asaas: 'center', link: 'center', status: 'center',
}
const CLASSE_ALINHA: Record<Alinha, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }
const JUSTIFICA: Record<Alinha, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

const COLUNAS: { id: ColunaId; titulo: string; dica?: string }[] = [
  { id: 'nome', titulo: 'Nome' },
  { id: 'celular', titulo: 'Celular' },
  { id: 'vencimento', titulo: 'Vencimento' },
  { id: 'ultimo', titulo: 'Pago', dica: 'Último pagamento' },
  { id: 'esporte', titulo: 'Esporte', dica: 'Esporte (bola) e modalidades (símbolos pequenos)' },
  { id: 'professor', titulo: 'Professor' },
  { id: 'valor', titulo: 'Valor' },
  { id: 'parcial', titulo: 'Parcial' },
  { id: 'asaas', titulo: 'Asaas', dica: 'Cadastro do aluno no Asaas' },
  { id: 'link', titulo: 'Link' },
  { id: 'status', titulo: 'Status' },
]

export default function Alunos() {
  const { unidadeId } = useUnidade()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [ordem, setOrdem] = useState<{ coluna: ColunaId; direcao: Direcao }>({ coluna: 'nome', direcao: 'asc' })

  // Modal pagamento
  const [modalAberto, setModalAberto] = useState(false)
  const [alunoModal, setAlunoModal] = useState<Aluno | null>(null)
  const [matriculasModal, setMatriculasModal] = useState<Matricula[]>([])
  const [formPgto, setFormPgto] = useState({
    forma_pagamento: 'Pix',
    data_pagamento: new Date().toLocaleDateString('en-CA'),
  })
  const [salvandoPgto, setSalvandoPgto] = useState(false)
  const [valorParcial, setValorParcial] = useState('')
  const [gerandoId, setGerandoId] = useState<string | null>(null)
  const [idAsaasAberto, setIdAsaasAberto] = useState<{ nome: string; id: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [responsavelAberto, setResponsavelAberto] = useState<Aluno | null>(null)
  const [retiradaAluno, setRetiradaAluno] = useState<Aluno | null>(null)
  const [historicoAluno, setHistoricoAluno] = useState<Aluno | null>(null)

  async function copiarId(id: string) {
    try {
      await navigator.clipboard.writeText(id)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch { /* sem permissão para copiar: o número continua visível para copiar à mão */ }
  }

  async function gerarCobranca(aluno: Aluno) {
    const txt = window.prompt(
      `Valor da cobrança de ${aluno.nome} (R$):`,
      aluno.valor_total ? String(aluno.valor_total) : ''
    )
    if (!txt) return
    const valor = Number(txt.replace(',', '.'))
    if (!valor || valor <= 0) return alert('Valor inválido')
    const hoje = new Date().toLocaleDateString('en-CA')
    const venc = aluno.data_vencimento && aluno.data_vencimento >= hoje ? aluno.data_vencimento : hoje
    setGerandoId(aluno.id)
    try {
      const res = await fetch('/api/pagamentos/criar-asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alunoId: aluno.id, valor, dataVencimento: venc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar cobrança')
      await carregar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar cobrança')
    } finally {
      setGerandoId(null)
    }
  }

  function mascaraValor(v: string) {
    v = v.replace(/\D/g, '')
    if (!v) return ''
    return (parseInt(v) / 100).toFixed(2).replace('.', ',')
  }

  async function carregar() {
    setLoading(true)

    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome, celular, cpf, status, data_vencimento, asaas_customer_id, unidade_id, responsavel_nome, responsavel_cpf, responsavel_celular')
      .order('nome')

    const { data: pagamentosLinkData } = await supabase
      .from('pagamentos')
      .select('aluno_id, link_pagamento')
      .not('link_pagamento', 'is', null)
      .neq('status', 'Pago')
      .neq('status', 'Cancelado')
      .order('data_vencimento', { ascending: false })

    const { data: matriculasData } = await supabase
      .from('matriculas')
      .select('aluno_id, tipo, valor, professor_nome, unidade_id, acesso_duas_unidades, esportes(nome)')

    const { data: pagamentosData } = await supabase
      .from('movimentacoes')
      .select('aluno_ref_id, data_pagamento, valor, descricao')
      .eq('tipo', 'Entrada')
      .eq('status', 'Recebido')
      .not('aluno_ref_id', 'is', null)
      .order('data_pagamento', { ascending: false })

    const mesAtual = new Date().toISOString().slice(0, 7)

    // Último pagamento, soma total paga e soma parcial no mês por aluno
    const ultimoPorAluno: Record<string, string> = {}
    const pagoMesPorAluno: Record<string, number> = {}
    const parcialMesPorAluno: Record<string, number> = {}
    for (const p of (pagamentosData ?? [])) {
      if (!p.aluno_ref_id) continue
      if (!ultimoPorAluno[p.aluno_ref_id]) {
        ultimoPorAluno[p.aluno_ref_id] = p.data_pagamento
      }
      if (p.data_pagamento?.startsWith(mesAtual)) {
        pagoMesPorAluno[p.aluno_ref_id] = (pagoMesPorAluno[p.aluno_ref_id] ?? 0) + (p.valor ?? 0)
        if (p.descricao?.toLowerCase().includes('parcial')) {
          parcialMesPorAluno[p.aluno_ref_id] = (parcialMesPorAluno[p.aluno_ref_id] ?? 0) + (p.valor ?? 0)
        }
      }
    }

    const linkPorAluno: Record<string, string> = {}
    for (const p of (pagamentosLinkData ?? [])) {
      if (p.aluno_id && !linkPorAluno[p.aluno_id]) {
        linkPorAluno[p.aluno_id] = p.link_pagamento
      }
    }

    // Aluno aparece na unidade escolhida se for dela (principal) ou se tiver matrícula nela (integração)
    const alunos = (alunosData ?? []).filter(a => !unidadeId || a.unidade_id === unidadeId ||
      (matriculasData ?? []).some(m => m.aluno_id === a.id && (m.unidade_id === unidadeId || m.acesso_duas_unidades))).map(a => {
      const mats = (matriculasData ?? []).filter(m => m.aluno_id === a.id)
      const valor_total = mats.reduce((acc, m) => acc + (m.valor ?? 0), 0)
      const porEsporte = new Map<string, Set<string>>()
      for (const m of mats) {
        const nome = (m.esportes as unknown as { nome: string } | null)?.nome ?? 'Sem esporte'
        porEsporte.set(nome, (porEsporte.get(nome) ?? new Set<string>()).add(m.tipo))
      }
      const esportesMod = Array.from(porEsporte.entries()).map(([esporte, tipos]) => ({ esporte, modalidades: Array.from(tipos) }))
      const professores_nomes = mats.filter(m => m.tipo === 'Aula' && m.professor_nome).map(m => m.professor_nome).join(' / ') || '-'
      return {
        ...a, valor_total, esportesMod, professores_nomes,
        combo: mats.some(m => m.acesso_duas_unidades),
        ultimo_pagamento: ultimoPorAluno[a.id] ?? null,
        pago_mes: pagoMesPorAluno[a.id] ?? 0,
        parcial_mes: parcialMesPorAluno[a.id] ?? 0,
        asaas_customer_id: a.asaas_customer_id ?? null,
        link_pagamento: linkPorAluno[a.id] ?? null,
      }
    })

    setAlunos(alunos)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [unidadeId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirModal(aluno: Aluno) {
    const { data } = await supabase
      .from('matriculas')
      .select('id, tipo, valor, professor_nome, professor_id')
      .eq('aluno_id', aluno.id)

    const mats = data ?? []
    const total = mats.reduce((acc, m) => acc + (m.valor ?? 0), 0)

    // Soma pagamentos já feitos no mês atual para este aluno
    const mesAtual = new Date().toLocaleDateString('en-CA').substring(0, 7) // YYYY-MM
    const { data: pgtos } = await supabase
      .from('movimentacoes')
      .select('valor')
      .eq('aluno_ref_id', aluno.id)
      .eq('status', 'Recebido')
      .gte('data_pagamento', `${mesAtual}-01`)
      .lte('data_pagamento', `${mesAtual}-31`)

    setMatriculasModal(mats)
    setAlunoModal(aluno)
    setFormPgto({ forma_pagamento: 'Pix', data_pagamento: new Date().toLocaleDateString('en-CA') })
    setValorParcial(total.toFixed(2).replace('.', ','))
    setModalAberto(true)
  }

  async function confirmarPagamento() {
    if (!alunoModal) return
    if (matriculasModal.length === 0) return alert('Este aluno não tem matrículas cadastradas.')
    const valorPago = parseFloat(valorParcial.replace(',', '.') || '0')
    setSalvandoPgto(true)

    // Tudo (lançamentos, vencimento, baixa e log) acontece numa operação só no banco: ou entra tudo, ou nada
    const { error } = await supabase.rpc('baixar_pagamento_manual', {
      p_aluno_id: alunoModal.id,
      p_forma: formPgto.forma_pagamento,
      p_data: formPgto.data_pagamento,
      p_valor: valorPago,
      p_vencimento: alunoModal.data_vencimento,
    })
    setSalvandoPgto(false)
    if (error) { alert(error.message); return }

    setModalAberto(false)
    setAlunoModal(null)
    carregar()
  }

  async function excluirAluno(id: string, nome: string) {
    if (!confirm('Excluir ' + nome + '? Esta ação não pode ser desfeita.')) return

    const { error: errMat } = await supabase.from('matriculas').delete().eq('aluno_id', id)
    if (errMat) { alert('Erro ao excluir matrículas: ' + errMat.message); return }

    const { error: errMov } = await supabase.from('movimentacoes').delete().eq('aluno_ref_id', id)
    if (errMov) { alert('Erro ao excluir movimentações: ' + errMov.message); return }

    const { error: errAlu } = await supabase.from('alunos').delete().eq('id', id)
    if (errAlu) { alert('Erro ao excluir aluno: ' + errAlu.message); return }

    await registrarLog('Excluiu aluno', 'alunos', id, nome)
    carregar()
  }

  // A coluna Parcial só aparece quando algum aluno tem pagamento parcial no mês (poupa largura da tabela)
  const presentes = new Set(alunos.flatMap(a => a.esportesMod.map(g => g.esporte)))
  const ordemEsportes = [...ORDEM_ESPORTES, ...Array.from(presentes).filter(n => !ORDEM_ESPORTES.includes(n))].filter(n => presentes.has(n))
  const temParcial = alunos.some(a => a.parcial_mes > 0)

  const filtrados = ordenar(alunos.filter(a => {
    const matchBusca = a.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      a.cpf?.includes(busca) ||
      a.celular?.includes(busca)
    const matchFiltro = filtro === 'Todos' || a.status === filtro
    return matchBusca && matchFiltro
  }), CHAVES[ordem.coluna], ordem.direcao)

  const pagination = usePagination(filtrados, 15)

  const contadores = {
    Todos: alunos.length,
    Ativo: alunos.filter(a => a.status === 'Ativo').length,
    Inativo: alunos.filter(a => a.status === 'Inativo').length,
  }

  function dataCurta(iso: string | null) {
    if (!iso) return '-'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y.slice(2)}`
  }

  function mascaraCelular(v: string) {
    v = v.replace(/\D/g, '').slice(0, 11)
    if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
    return v
  }

  return (
    <div className="ampliar-15">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-page-title text-gray-900">Alunos</h1>
        <Link
          href="/alunos/novo"
          className="flex items-center gap-2 bg-[#7DC421] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#6ab01a] transition-colors"
        >
          + Novo aluno
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou celular..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="flex-1 min-w-[16rem] h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7DC421]/40 focus:border-[#7DC421]"
        />
        <div className="flex gap-2">
          {(['Todos', 'Ativo', 'Inativo'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                filtro === f
                  ? 'bg-[#7DC421] text-white border-[#7DC421] shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f} ({contadores[f as keyof typeof contadores] ?? alunos.length})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap border-separate border-spacing-0">
            <thead className="[&>tr>th]:border-b [&>tr>th]:border-gray-200">
              <tr className="bg-gray-50/80">
                {COLUNAS.filter(c => c.id !== 'parcial' || temParcial).map(c => {
                  const ativa = ordem.coluna === c.id
                  return (
                    <th
                      key={c.id}
                      onClick={() => setOrdem(o => proximaOrdem(o, c.id))}
                      title={`${c.dica ?? c.titulo} — clique para ordenar`}
                      aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`${CLASSE_ALINHA[ALINHA[c.id]]} ${c.id === 'nome' ? 'sticky left-0 z-20 bg-gray-50' : ''} px-2 h-11 text-th text-gray-600 cursor-pointer select-none hover:bg-gray-100 hover:text-gray-800 transition-colors`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.titulo}
                        {ativa
                          ? (ordem.direcao === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />)
                          : <ArrowUpDown size={12} className="text-gray-300" />}
                      </span>
                    </th>
                  )
                })}
                <th className="sticky right-0 z-20 bg-gray-50 text-center px-2 h-11 text-th text-gray-600 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">Ações</th>
              </tr>
          </thead>
          <tbody className="[&>tr>td]:border-b [&>tr>td]:border-gray-100">
            {loading && (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400">Nenhum aluno encontrado.</td></tr>
            )}
            {pagination.paginatedItems.map((aluno, i) => (
              <tr key={aluno.id} className={`group h-12 hover:bg-[#7DC421]/[0.06] transition-colors ${i === pagination.paginatedItems.length - 1 && pagination.currentPage === pagination.totalPages ? 'border-0' : ''}`}>
                <td className="sticky left-0 z-10 bg-white group-hover:bg-[#f6fbee] transition-colors px-2 font-semibold text-gray-900 min-w-[11rem]">
                  <div className="flex items-center justify-between gap-2">
                    <span>{aluno.nome}</span>
                    <span className="flex shrink-0 items-center gap-1">
                    {aluno.combo ? (
                      <span title="Combo: treina nas duas unidades (Boa Bola 1 e 2)" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-700 ring-1 ring-green-200">C</span>
                    ) : <span className="inline-block h-5 w-5 shrink-0" />}
                    {aluno.responsavel_nome ? (
                      <button
                        onClick={() => setResponsavelAberto(aluno)}
                        title="Este aluno tem responsável — clique para ver"
                        aria-label={`Ver responsável de ${aluno.nome}`}
                        className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-200"
                      >R</button>
                    ) : <span className="inline-block h-5 w-5 shrink-0" />}
                    </span>
                  </div>
                </td>
                <td className="px-2 text-gray-700 tabular-nums">
                  <a href={`https://wa.me/55${aluno.celular.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[#1f9d4d] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="shrink-0" viewBox="0 0 24 24" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {mascaraCelular(aluno.celular)}
                  </a>
                </td>
                <td className="px-2 text-center text-gray-700 tabular-nums">
                  {dataCurta(aluno.data_vencimento)}
                </td>
                <td className="px-2 text-center text-gray-700 tabular-nums">
                  {dataCurta(aluno.ultimo_pagamento)}
                </td>
                <td className="px-2 py-1.5">
                  {aluno.esportesMod.length === 0 ? (
                    <span className="text-gray-400">-</span>
                  ) : (
                    <div className="flex items-start">
                      {ordemEsportes.map(nome => {
                        const g = aluno.esportesMod.find(x => x.esporte === nome)
                        return (
                          <div key={nome} className="flex w-9 shrink-0 flex-col items-center gap-0.5" title={g ? `${g.esporte}: ${g.modalidades.map(m => (m === 'Aula' ? 'Aulas' : m)).join(', ')}` : undefined}>
                            {g && (
                              <>
                                <IconeEsporte nome={g.esporte} tamanho={22} />
                                <span className="flex items-center gap-0.5">
                                  {g.modalidades.map(m => <IconeModalidade key={m} tipo={m} tamanho={12} />)}
                                </span>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </td>
                <td className="px-2 text-gray-700 max-w-[9rem] truncate" title={aluno.professores_nomes}>{aluno.professores_nomes}</td>
                <td className="px-2 text-right font-medium text-gray-900 tabular-nums">
                  {aluno.valor_total > 0 ? `R$ ${aluno.valor_total.toFixed(2).replace('.', ',')}` : '-'}
                </td>
                {temParcial && <td className="px-2 text-right font-medium tabular-nums">
                  {aluno.parcial_mes > 0 ? (
                    <span className="text-yellow-600">R$ {aluno.parcial_mes.toFixed(2).replace('.', ',')}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>}
                <td className="px-2 text-center">
                  {aluno.asaas_customer_id ? (
                    <button
                      onClick={() => { setCopiado(false); setIdAsaasAberto({ nome: aluno.nome, id: aluno.asaas_customer_id! }) }}
                      title="Cadastrado no Asaas — clique para ver o número"
                      className="inline-flex h-8 w-7 items-center justify-center rounded-lg text-green-600 hover:bg-green-50 hover:text-green-800 transition-colors"
                    >
                      <BadgeCheck size={20} />
                    </button>
                  ) : (
                    <span className="text-gray-300" title="Ainda não cadastrado no Asaas">-</span>
                  )}
                </td>
                <td className="px-2 text-center">
                  {aluno.link_pagamento ? (
                    <a href={aluno.link_pagamento} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 h-8 px-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"><Link2 size={14} />Pagar</a>
                  ) : (
                    <button
                      onClick={() => gerarCobranca(aluno)}
                      title="Gerar cobrança"
                      disabled={gerandoId === aluno.id}
                      className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-[#7DC421] transition-colors disabled:text-gray-400"
                    >
                      {gerandoId === aluno.id ? 'Gerando...' : <><CreditCard size={14} />Gerar</>}
                    </button>
                  )}
                </td>
                <td className="px-2 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                    aluno.status === 'Ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${aluno.status === 'Ativo' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {aluno.status}
                  </span>
                </td>
                <td className="sticky right-0 z-10 bg-white group-hover:bg-[#f6fbee] transition-colors px-2 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]"><div className="flex items-center justify-center gap-0.5">
                  <button
                    onClick={() => abrirModal(aluno)}
                    title="Registrar pagamento"
                    aria-label={`Registrar pagamento de ${aluno.nome}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-[#5a9217] hover:bg-green-50"
                  ><CircleDollarSign size={18} /></button>
                  <button
                    onClick={() => setHistoricoAluno(aluno)}
                    title="Histórico de pagamentos (mensalidades e produtos)"
                    aria-label={`Histórico de pagamentos de ${aluno.nome}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  ><History size={18} /></button>
                  <button
                    onClick={() => setRetiradaAluno(aluno)}
                    title="Retirar produto (estoque)"
                    aria-label={`Retirar produto para ${aluno.nome}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  ><Package size={18} /></button>
                  <Link href={`/alunos/${aluno.id}/editar`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-gray-500 hover:bg-blue-50 hover:text-blue-600" title="Editar" aria-label={`Editar ${aluno.nome}`}><Pencil size={18} /></Link>
                  <button
                    onClick={() => excluirAluno(aluno.id, aluno.nome)}
                    title="Excluir aluno"
                    aria-label={`Excluir ${aluno.nome}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-gray-400 hover:bg-red-50 hover:text-red-600"
                  ><Trash2 size={18} /></button>
                </div></td>
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

      {/* Histórico de pagamentos do aluno */}
      {historicoAluno && <HistoricoAluno aluno={{ id: historicoAluno.id, nome: historicoAluno.nome }} onFechar={() => setHistoricoAluno(null)} />}

      {/* Retirada de produto do estoque para o aluno */}
      {retiradaAluno && (
        <VendaDoAluno aluno={{ id: retiradaAluno.id, nome: retiradaAluno.nome, data_vencimento: retiradaAluno.data_vencimento }} onFechar={() => setRetiradaAluno(null)} />
      )}

      {/* Dados do responsável (abre ao clicar no R ao lado do nome) */}
      {responsavelAberto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setResponsavelAberto(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-section-title text-gray-900">Responsável</div>
                <div className="text-sm text-gray-500">de {responsavelAberto.nome}</div>
              </div>
              <button onClick={() => setResponsavelAberto(null)} className="text-gray-400 hover:text-gray-600" title="Fechar"><X size={18} /></button>
            </div>
            <dl className="text-sm space-y-2">
              <div><dt className="text-xs text-gray-500">Nome</dt><dd className="text-gray-900 font-medium">{responsavelAberto.responsavel_nome}</dd></div>
              <div><dt className="text-xs text-gray-500">CPF</dt><dd className="text-gray-900">{responsavelAberto.responsavel_cpf || '—'}</dd></div>
              <div>
                <dt className="text-xs text-gray-500">Celular</dt>
                <dd className="text-gray-900">
                  {responsavelAberto.responsavel_celular ? (
                    <a href={`https://wa.me/55${responsavelAberto.responsavel_celular.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{responsavelAberto.responsavel_celular}</a>
                  ) : '—'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-gray-500">A cobrança e os avisos de pagamento deste aluno vão para o responsável.</p>
          </div>
        </div>
      )}

      {/* Número do cadastro no Asaas (só aparece quando o operador clica no ícone) */}
      {idAsaasAberto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setIdAsaasAberto(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-section-title text-gray-900">Cadastro no Asaas</div>
                <div className="text-sm text-gray-500">{idAsaasAberto.nome}</div>
              </div>
              <button onClick={() => setIdAsaasAberto(null)} className="text-gray-400 hover:text-gray-600" title="Fechar"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 select-all break-all">{idAsaasAberto.id}</code>
              <button onClick={() => copiarId(idAsaasAberto.id)} className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento */}
      {modalAberto && alunoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-section-title text-gray-900">Registrar pagamento</h2>
              <p className="text-sm text-gray-500 mt-1">{alunoModal.nome}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Matrículas */}
              <div>
                <div className="text-th text-gray-400 mb-2">Matrículas</div>
                {matriculasModal.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma matrícula encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {matriculasModal.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{m.tipo}</span>
                          {m.professor_nome && (
                            <span className="text-sm text-gray-500 ml-2">— {m.professor_nome}</span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-[#7DC421]">
                          R$ {m.valor.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-gray-100">
                      <span className="text-sm font-medium text-gray-500">Total</span>
                      <span className="text-sm font-bold text-gray-900">
                        R$ {matriculasModal.reduce((acc, m) => acc + m.valor, 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Valor pago */}
              {matriculasModal.length > 0 && (
                <div>
                  <label className="text-label text-gray-500 block mb-1">Valor pago</label>
                  <input
                    type="text"
                    value={valorParcial}
                    onChange={e => {
                      const totalMats = matriculasModal.reduce((acc, m) => acc + (m.valor ?? 0), 0)
                      const masked = mascaraValor(e.target.value)
                      const num = parseFloat(masked.replace(',', '.')) || 0
                      if (num > totalMats) {
                        setValorParcial(totalMats.toFixed(2).replace('.', ','))
                      } else {
                        setValorParcial(masked)
                      }
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="0,00"
                  />
                  {(() => {
                    const total = matriculasModal.reduce((acc, m) => acc + m.valor, 0)
                    const pago = parseFloat(valorParcial.replace(',', '.')) || 0
                    if (pago > 0 && pago < total) {
                      return <p className="text-xs text-yellow-600 mt-1">Pagamento parcial — R$ {(total - pago).toFixed(2).replace('.', ',')} restante</p>
                    }
                    if (pago >= total) {
                      return <p className="text-xs text-green-600 mt-1">✓ Pagamento total</p>
                    }
                    return null
                  })()}
                </div>
              )}

              {/* Forma de pagamento */}
              <div>
                <label className="text-label text-gray-500 block mb-1">Meio de pagamento</label>
                <select
                  value={formPgto.forma_pagamento}
                  onChange={e => setFormPgto({ ...formPgto, forma_pagamento: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão Débito</option>
                  <option>Cartão Crédito</option>
                  <option>Transferência</option>
                </select>
              </div>

              {/* Data de pagamento */}
              <div>
                <label className="text-label text-gray-500 block mb-1">Data de pagamento</label>
                <input
                  type="date"
                  value={formPgto.data_pagamento}
                  onChange={e => setFormPgto({ ...formPgto, data_pagamento: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setModalAberto(false); setAlunoModal(null) }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPagamento}
                disabled={salvandoPgto || matriculasModal.length === 0}
                className="px-4 py-2 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50"
              >
                {salvandoPgto ? 'Salvando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
