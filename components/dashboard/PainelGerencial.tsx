'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Info, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import FluxoDeCaixa from '@/components/dashboard/FluxoDeCaixa'
import { VendasDeProdutos } from '@/components/dashboard/GraficosProdutosAlunos'
import { mesesEntre, serieMensal, type Evento } from '@/lib/painel-graficos'
import { FiltroMeses, FiltroPeriodo, PRESETS, TemaRecolhivel, useJanela, usePeriodo } from '@/components/dashboard/FiltroPeriodo'
import type { MovFluxo } from '@/lib/fluxo-caixa'
import {
  alunosDaModalidade, aparaMesesVazios, calcularKpis, faixasDeAtraso, gastosDoPeriodo, itensFinanceiros, mesesDaJanela,
  participacao, periodoDe, pontosDeAtencao, serieAlunosAtivos, serieFinanceira, statusDosPagamentos, ticketMedio, variacao,
  type AlunoP, type MatP, type MovP, type PagP, type Preset,
} from '@/lib/painel'
import {
  alunosPorModalidade, faturamentoPorProfessor, resumoPorMes, totaisDoPeriodo,
  type Mov,
} from '@/lib/relatorios'

/* ---------- formatação brasileira ---------- */
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 })}%`
const tip = (v: unknown) => brl(Number(v ?? 0))

/* ---------- cores com significado fixo (as mesmas em todo o painel) ---------- */
const COR = {
  recebido: '#16A34A', // dinheiro que entrou / positivo
  marca: '#7DC421', // receita (verde do Boa Bola)
  aVencer: '#F59E0B', // previsto, ainda no prazo
  vencido: '#DC2626', // atrasado / despesa / negativo
  anterior: '#9CA3AF', // comparação com o período anterior
  base: '#2563EB', // base de alunos
  cancelado: '#6B7280',
}
const COR_ESPORTE: Record<string, string> = {
  'Beach Tênis': '#F97316', 'Tênis': '#84A60F', Padel: '#2563EB', Pickleball: '#EAB308', 'Sem esporte': '#9CA3AF',
}
const corEsporte = (n: string) => COR_ESPORTE[n] ?? '#6B7280'
const COR_STATUS: Record<string, string> = { Pagos: COR.recebido, 'A vencer': COR.aVencer, Vencidos: COR.vencido, Cancelados: COR.cancelado }

/* ---------- padrão dos gráficos ---------- */
const ALTURA = 240
const MARGEM = { top: 8, right: 8, left: 0, bottom: 0 }
const eixoY = { width: 52, tick: { fontSize: 12 }, tickLine: false, axisLine: false } as const
const eixoX = { tick: { fontSize: 12 }, tickLine: false } as const
const legenda = { wrapperStyle: { fontSize: 12, paddingTop: 6 } } as const
const Grade = () => <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />

/* ---------- peças visuais ---------- */
function Delta({ atual, anterior, subiuEhBom = true }: { atual: number; anterior: number; subiuEhBom?: boolean }) {
  const v = variacao(atual, anterior)
  if (v === null) return <span className="text-xs text-gray-400">sem base de comparação</span>
  if (Math.abs(v) < 0.05) return <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Minus size={12} /> igual ao período anterior</span>
  const bom = (v > 0) === subiuEhBom
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${bom ? 'text-green-700' : 'text-red-600'}`}>
      {v > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {pct(Math.abs(v))} <span className="font-normal text-gray-500">vs. anterior</span>
    </span>
  )
}

/** Cartão principal (destaque): valor grande. */
function KpiPrincipal({ rotulo, valor, cor, href, children }: { rotulo: string; valor: string; cor?: string; href?: string; children?: React.ReactNode }) {
  const corpo = (
    <div className={`h-full bg-white border border-gray-200 rounded-xl p-4 sm:p-5 ${href ? 'hover:border-gray-300 hover:shadow-sm transition' : ''}`}>
      <div className="text-sm font-medium text-gray-600">{rotulo}</div>
      <div className={`text-kpi-lg mt-1 ${cor ?? 'text-gray-900'}`}>{valor}</div>
      <div className="mt-2 min-h-[2.25rem] space-y-0.5">{children}</div>
    </div>
  )
  return href ? <Link href={href} className="block h-full">{corpo}</Link> : corpo
}

/** Cartão secundário (compacto). */
function KpiSecundario({ rotulo, valor, cor, href, children }: { rotulo: string; valor: string; cor?: string; href?: string; children?: React.ReactNode }) {
  const corpo = (
    <div className={`h-full bg-white border border-gray-200 rounded-xl p-4 ${href ? 'hover:border-gray-300 hover:shadow-sm transition' : ''}`}>
      <div className="text-xs font-medium text-gray-600">{rotulo}</div>
      <div className={`text-kpi-sm mt-0.5 ${cor ?? 'text-gray-900'}`}>{valor}</div>
      <div className="mt-1 min-h-[2rem] space-y-0.5">{children}</div>
    </div>
  )
  return href ? <Link href={href} className="block h-full">{corpo}</Link> : corpo
}

function Aux({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-500 leading-4">{children}</div>
}

function Grafico({ titulo, nota, vazio, mensagemVazio, carregando, altura = ALTURA, children, largo }: { titulo: string; nota?: string; vazio?: boolean; mensagemVazio?: string; carregando?: boolean; altura?: number; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${largo ? 'lg:col-span-2' : ''}`}>
      <div className="text-sm font-semibold text-gray-900">{titulo}</div>
      {nota && <div className="text-xs text-gray-500">{nota}</div>}
      <div className="mt-3" style={{ minHeight: altura }}>
        {carregando ? (
          <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: altura }}>Carregando...</div>
        ) : vazio ? (
          <div className="flex items-center justify-center text-center text-sm text-gray-400 px-4" style={{ height: altura }}>{mensagemVazio ?? 'Sem dados neste período'}</div>
        ) : children}
      </div>
    </div>
  )
}

type LinhaAluno = { id: string; status: string | null; data_cadastro: string | null; data_inativacao?: string | null; data_vencimento: string | null; unidade_id: string | null }
type LinhaMat = { aluno_id: string; tipo: string; valor: number | null; unidade_id: string | null; acesso_duas_unidades: boolean | null; esporte_id: string | null; esportes: { nome: string } | null }
type LinhaMov = {
  tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null; data_vencimento: string | null
  aluno_ref_id: string | null; professor_id: string | null; professores: { nome: string } | null; esportes: { nome: string } | null
  conta_bancaria_id: string | null; contas_bancarias: { nome: string } | null
}

export default function PainelGerencial() {
  const { unidadeId, unidade } = useUnidade()
  const hoje = useMemo(() => new Date().toLocaleDateString('en-CA'), [])

  const [preset, setPreset] = useState<Preset>('mes_atual')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [modalidade, setModalidade] = useState('')
  // Cada tema tem o seu próprio período; o do topo vale só para os indicadores principais
  const pFin = usePeriodo(hoje)
  const jAlu = useJanela(hoje, 6)
  const pMod = usePeriodo(hoje)
  const pPag = usePeriodo(hoje)

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rastreiaInativacao, setRastreiaInativacao] = useState(true)
  const [alunos, setAlunos] = useState<LinhaAluno[]>([])
  const [mats, setMats] = useState<LinhaMat[]>([])
  const [movs, setMovs] = useState<LinhaMov[]>([])
  const [pags, setPags] = useState<PagP[]>([])
  // Quando cada aluno foi inativado (registrada ou estimada), para a base de alunos ativos
  const [saidas, setSaidas] = useState<Record<string, string>>({})
  const [esporteAlu, setEsporteAlu] = useState('')

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setLoading(true)
      setErro(null)
      const corte = `${new Date().getFullYear() - 2}-01-01`

      // data_inativacao só existe depois da atualização do banco: se faltar, o painel segue sem ela
      let rastreia = true
      let ra = await buscarTudo((de, ate) => supabase.from('alunos').select('id, status, data_cadastro, data_inativacao, data_vencimento, unidade_id').order('id').range(de, ate))
      if (ra.error) {
        rastreia = false
        ra = await buscarTudo((de, ate) => supabase.from('alunos').select('id, status, data_cadastro, data_vencimento, unidade_id').order('id').range(de, ate)) as typeof ra
      }
      const [rm, rf, rp] = await Promise.all([
        buscarTudo((de, ate) => supabase.from('matriculas').select('aluno_id, tipo, valor, unidade_id, acesso_duas_unidades, esporte_id, esportes(nome)').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase
          .from('movimentacoes')
          .select('tipo, status, valor, data, data_pagamento, data_vencimento, aluno_ref_id, professor_id, conta_bancaria_id, professores(nome), esportes(nome), contas_bancarias(nome)')
          .eq('unidade_id', unidadeId)
          .or(`data.gte.${corte},data_pagamento.gte.${corte},status.neq.Recebido`)
          .order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('pagamentos').select('aluno_id, valor, status, data_vencimento').neq('status', 'Pago').order('id').range(de, ate)),
      ])
      // Se a tabela do histórico ainda não existir no banco, o gráfico segue só com as datas registradas
      const rh = await buscarTudo((de, ate) => supabase.from('alunos_status_historico').select('aluno_id, data').eq('para_status', 'Inativo').order('data').order('id').range(de, ate))
      if (cancelado) return
      if (ra.error || rm.error || rf.error || rp.error) {
        setErro('Não consegui carregar os dados do painel. Atualize a página; se continuar, avise o suporte.')
        setLoading(false)
        return
      }
      setRastreiaInativacao(rastreia)
      setAlunos((ra.data ?? []) as unknown as LinhaAluno[])
      setMats((rm.data ?? []) as unknown as LinhaMat[])
      setMovs((rf.data ?? []) as unknown as LinhaMov[])
      setPags((rp.data ?? []) as PagP[])
      setSaidas(rh.error ? {} : Object.fromEntries(((rh.data ?? []) as unknown as { aluno_id: string; data: string }[]).map(x => [x.aluno_id, x.data])))
      setLoading(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId])

  /* ---------- recortes: unidade e modalidade ---------- */
  const dados = useMemo(() => {
    // Aluno da unidade: é dela (principal) ou tem matrícula nela / em combo
    const matsDaUnidade = mats.filter(m => !unidadeId || m.unidade_id === unidadeId || m.acesso_duas_unidades)
    const idsComMatricula = new Set(matsDaUnidade.map(m => m.aluno_id))
    const alunosU = alunos.filter(a => !unidadeId || a.unidade_id === unidadeId || idsComMatricula.has(a.id))
    const idsU = new Set(alunosU.map(a => a.id))
    const matsU = matsDaUnidade.filter(m => idsU.has(m.aluno_id))
    const pagsU = pags.filter(p => p.aluno_id && idsU.has(p.aluno_id))

    const noFiltro = alunosDaModalidade(matsU, modalidade || null)
    const alunosF = noFiltro ? alunosU.filter(a => noFiltro.has(a.id)) : alunosU
    const matsF = (modalidade ? matsU.filter(m => m.tipo === modalidade) : matsU)
    const movsF = noFiltro ? movs.filter(m => m.aluno_ref_id && noFiltro.has(m.aluno_ref_id)) : movs
    const pagsF = noFiltro ? pagsU.filter(p => p.aluno_id && noFiltro.has(p.aluno_id)) : pagsU
    return { alunosF, matsF, movsF, pagsF, matsU, alunosU }
  }, [alunos, mats, movs, pags, unidadeId, modalidade])

  const periodo = useMemo(() => periodoDe(preset, hoje, de, ate), [preset, hoje, de, ate])
  const mesesFin = useMemo(() => mesesDaJanela(pFin.periodo.inicio, pFin.periodo.fim, 6), [pFin.periodo])
  // Tema Alunos: o gráfico mostra exatamente os meses escolhidos (6 meses, 1 ano ou datas)
  const mesesAlu = useMemo(() => mesesEntre(jAlu.janela.inicio, jAlu.janela.fim), [jAlu.janela])

  const alunosP: AlunoP[] = useMemo(() => dados.alunosF.map(a => ({
    id: a.id, status: a.status, data_cadastro: a.data_cadastro, data_inativacao: a.data_inativacao ?? null, data_vencimento: a.data_vencimento,
  })), [dados.alunosF])
  const matsP: MatP[] = useMemo(() => dados.matsF.map(m => ({ aluno_id: m.aluno_id, tipo: m.tipo, valor: m.valor })), [dados.matsF])
  const movsP: MovP[] = useMemo(() => dados.movsF.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento, data_vencimento: m.data_vencimento, aluno_ref_id: m.aluno_ref_id,
  })), [dados.movsF])

  const itens = useMemo(() => itensFinanceiros(movsP, dados.pagsF), [movsP, dados.pagsF])
  // O recorte por modalidade já foi aplicado nos dados; aqui não filtra de novo
  const kpis = useMemo(() => calcularKpis({ alunos: alunosP, mats: matsP, itens, periodo, hoje, modalidade: null }), [alunosP, matsP, itens, periodo, hoje])
  const ticket = useMemo(() => ticketMedio(itens, periodo.inicio, periodo.fim), [itens, periodo])
  const ticketAnt = useMemo(() => ticketMedio(itens, periodo.inicioAnt, periodo.fimAnt), [itens, periodo])
  // Gastos são do negócio (não de um aluno): contam sempre a unidade toda, mesmo com filtro de modalidade
  const movsDaUnidade: MovP[] = useMemo(() => movs.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento, data_vencimento: m.data_vencimento, aluno_ref_id: m.aluno_ref_id,
  })), [movs])
  const gastos = useMemo(() => gastosDoPeriodo(movsDaUnidade, periodo.inicio, periodo.fim), [movsDaUnidade, periodo])
  const gastosAnt = useMemo(() => gastosDoPeriodo(movsDaUnidade, periodo.inicioAnt, periodo.fimAnt), [movsDaUnidade, periodo])

  const financeira = useMemo(
    () => aparaMesesVazios(serieFinanceira(itens, mesesFin, hoje), l => l.recebida > 0 || l.anterior > 0 || l.aReceber > 0),
    [itens, mesesFin, hoje]
  )
  const temAnterior = financeira.some(l => l.anterior > 0)
  // Esporte escolhido no tema Alunos: só quem tem matrícula nele
  const esportesAlu = useMemo(() => {
    const por = new Map<string, string>()
    for (const m of dados.matsU) if (m.esporte_id && m.esportes?.nome) por.set(m.esporte_id, m.esportes.nome)
    return [...por.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [dados.matsU])
  const alunosDoGrafico = useMemo(() => {
    const doEsporte = esporteAlu ? new Set(dados.matsU.filter(m => m.esporte_id === esporteAlu).map(m => m.aluno_id)) : null
    return alunosP
      .filter(a => !doEsporte || doEsporte.has(a.id))
      .map(a => (a.status === 'Inativo' && !a.data_inativacao && saidas[a.id] ? { ...a, data_inativacao: saidas[a.id] } : a))
  }, [alunosP, dados.matsU, esporteAlu, saidas])
  const inativacoesMes = useMemo(() => {
    const doEsporte = esporteAlu ? new Set(dados.matsU.filter(m => m.esporte_id === esporteAlu).map(m => m.aluno_id)) : null
    const eventos: Evento[] = []
    for (const a of alunosP) {
      if (doEsporte && !doEsporte.has(a.id)) continue
      if (a.data_inativacao) eventos.push({ data: a.data_inativacao, grupo: 'registrada' })
      else if (a.status === 'Inativo' && saidas[a.id]) eventos.push({ data: saidas[a.id], grupo: 'estimada' })
    }
    return serieMensal(eventos, jAlu.janela, ['registrada', 'estimada'])
  }, [alunosP, dados.matsU, esporteAlu, saidas, jAlu.janela])
  const serieA = useMemo(() => serieAlunosAtivos(alunosDoGrafico, mesesAlu, hoje), [alunosDoGrafico, mesesAlu, hoje])
  const status = useMemo(() => statusDosPagamentos(itens, pPag.periodo, hoje), [itens, pPag.periodo, hoje])
  const faixas = useMemo(() => faixasDeAtraso(itens, hoje), [itens, hoje])

  const movsRel: Mov[] = useMemo(() => dados.movsF.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento,
    professor_id: m.professor_id, professor_nome: m.professores?.nome ?? null, esporte_nome: m.esportes?.nome ?? null,
  })), [dados.movsF])
  const mesesPeriodoFin = useMemo(() => mesesDaJanela(pFin.periodo.inicio, pFin.periodo.fim, 1), [pFin.periodo])
  const mesesPeriodoMod = useMemo(() => mesesDaJanela(pMod.periodo.inicio, pMod.periodo.fim, 1), [pMod.periodo])
  // O lucro usa todas as movimentações da unidade (despesas não pertencem a uma modalidade)
  const movsRelUnidade: Mov[] = useMemo(() => movs.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento,
    professor_id: m.professor_id, professor_nome: m.professores?.nome ?? null, esporte_nome: m.esportes?.nome ?? null,
  })), [movs])
  const movsFluxo: MovFluxo[] = useMemo(() => movs.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento, data_vencimento: m.data_vencimento, conta_id: m.conta_bancaria_id,
  })), [movs])
  // Mensalidades dos alunos ativos da unidade toda (o caixa não se divide por modalidade)
  const mensalidadesUnidade = useMemo(() => {
    const ativos = new Set(dados.alunosU.filter(a => a.status === 'Ativo').map(a => a.id))
    return Math.round(dados.matsU.filter(m => ativos.has(m.aluno_id)).reduce((t, m) => t + (Number(m.valor) || 0), 0) * 100) / 100
  }, [dados.alunosU, dados.matsU])
  const lucro = useMemo(
    () => aparaMesesVazios(resumoPorMes(movsRelUnidade, mesesFin), l => l.bruto > 0 || l.despesas > 0),
    [movsRelUnidade, mesesFin]
  )
  const totaisPeriodo = useMemo(() => totaisDoPeriodo(resumoPorMes(movsRelUnidade, mesesPeriodoFin)), [movsRelUnidade, mesesPeriodoFin])
  const porProfessor = useMemo(() => faturamentoPorProfessor(movsRel, mesesPeriodoMod), [movsRel, mesesPeriodoMod])

  const matsRel = useMemo(() => dados.matsF.map(m => ({
    aluno_id: m.aluno_id, tipo: m.tipo, unidade_id: m.unidade_id, acesso_duas_unidades: m.acesso_duas_unidades, esporte_nome: m.esportes?.nome ?? null,
  })), [dados.matsF])
  const porModalidade = useMemo(() => alunosPorModalidade(dados.alunosF.map(a => ({ id: a.id, status: a.status })), matsRel, unidadeId), [dados.alunosF, matsRel, unidadeId])
  const fatiasModalidade = useMemo(() => participacao(porModalidade.dados), [porModalidade])

  const modalidadesDisponiveis = useMemo(() => Array.from(new Set(dados.matsU.map(m => m.tipo))).sort(), [dados.matsU])
  const inativosSemData = useMemo(() => alunosDoGrafico.filter(a => a.status === 'Inativo' && !a.data_inativacao).length, [alunosDoGrafico])
  const inativosEstimados = useMemo(() => alunosDoGrafico.filter(a => a.status === 'Inativo' && !!saidas[a.id]).length, [alunosDoGrafico, saidas])

  const atencao = useMemo(() => pontosDeAtencao({
    kpis, itens, alunos: alunosP, mats: matsP, saidas: movsDaUnidade, hoje, rastreiaInativacao,
  }), [kpis, itens, alunosP, matsP, movsDaUnidade, hoje, rastreiaInativacao])

  const semAtivos = !loading && kpis.alunosAtivos === 0
  const rotuloPeriodo = periodo.inicio === periodo.fim ? periodo.inicio : `${periodo.inicio.split('-').reverse().join('/')} a ${periodo.fim.split('-').reverse().join('/')}`
  const nomeModalidade = modalidade === 'Aula' ? 'Aulas' : modalidade

  return (
    <div className="max-w-6xl">
      {/* Cabeçalho e filtros */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div className="pl-12 md:pl-0">
          <h1 className="text-page-title text-gray-900">Painel</h1>
          <p className="text-sm text-gray-500">{unidade?.nome ?? ''} · {preset === 'custom' && (!de || !ate) ? 'escolha as duas datas' : rotuloPeriodo}{modalidade ? ` · ${nomeModalidade}` : ''}</p>
          <select value={modalidade} onChange={e => setModalidade(e.target.value)} className="mt-2 block h-9 border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="Modalidade">
            <option value="">Todas as modalidades</option>
            {modalidadesDisponiveis.map(m => <option key={m} value={m}>{m === 'Aula' ? 'Aulas' : m}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="inline-flex max-w-[calc(100vw-2rem)] overflow-x-auto rounded-lg border border-gray-200 bg-white">
            {PRESETS.map(p => (
              <button key={p.id} type="button" onClick={() => setPreset(p.id)}
                className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${preset === p.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {p.nome}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="inline-flex shrink-0 items-center gap-2 text-sm text-gray-600">
              <input type="date" value={de} max={hoje} onChange={e => setDe(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="De" />
              até
              <input type="date" value={ate} max={hoje} onChange={e => setAte(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="Até" />
            </div>
          )}
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiPrincipal rotulo="Receita recebida" valor={loading ? '...' : brl(kpis.recebida)} cor="text-green-700" href="/financeiro">
          {!loading && <Delta atual={kpis.recebida} anterior={kpis.recebidaAnt} />}
        </KpiPrincipal>
        <KpiPrincipal rotulo="Alunos ativos" valor={loading ? '...' : String(kpis.alunosAtivos)} href="/alunos">
          {!loading && <Aux>Mensalidades somam {brl(kpis.potencialMensal)}</Aux>}
        </KpiPrincipal>
        <KpiPrincipal rotulo="Valores vencidos" valor={loading ? '...' : brl(kpis.vencidoValor)} cor={kpis.vencidoValor > 0 ? 'text-red-600' : 'text-gray-900'} href="/atraso">
          {!loading && (
            <>
              <Aux>{kpis.vencidoQtd} {kpis.vencidoQtd === 1 ? 'cobrança vencida' : 'cobranças vencidas'}</Aux>
              <Aux>Total em aberto: {brl(kpis.abertoValor)}</Aux>
            </>
          )}
        </KpiPrincipal>
        <KpiPrincipal rotulo="Novos alunos" valor={loading ? '...' : String(kpis.novos)} href="/alunos">
          {!loading && <Delta atual={kpis.novos} anterior={kpis.novosAnt} />}
        </KpiPrincipal>
      </div>

      {/* Indicadores de apoio */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiSecundario rotulo="Receita prevista" valor={loading ? '...' : brl(kpis.prevista)} href="/contas-receber">
          {!loading && <Delta atual={kpis.prevista} anterior={kpis.previstaAnt} />}
        </KpiSecundario>
        <KpiSecundario rotulo="Ticket médio" valor={loading ? '...' : ticket.valor === null ? '—' : brl(ticket.valor)}>
          {!loading && (ticket.valor === null ? <Aux>sem pagamentos de alunos</Aux> : <Delta atual={ticket.valor} anterior={ticketAnt.valor ?? 0} />)}
        </KpiSecundario>
        <KpiSecundario rotulo="Gastos mensais" valor={loading ? '...' : brl(gastos.pagos)} cor="text-red-600" href="/contas-pagar">
          {!loading && <Delta atual={gastos.pagos} anterior={gastosAnt.pagos} subiuEhBom={false} />}
          {!loading && <Aux>{gastos.qtdAPagar > 0 ? `A pagar: ${brl(gastos.aPagar)}` : 'Nada a pagar em aberto'}</Aux>}
        </KpiSecundario>
        <KpiSecundario rotulo="Inadimplência" valor={loading ? '...' : kpis.inadimplenciaPct === null ? '—' : pct(kpis.inadimplenciaPct)} cor={kpis.inadimplentes > 0 ? 'text-red-600' : 'text-gray-900'} href="/atraso">
          {!loading && <Aux>{kpis.inadimplentes} de {kpis.alunosAtivos} alunos ativos</Aux>}
        </KpiSecundario>
        <KpiSecundario rotulo="Inativações" valor={loading ? '...' : rastreiaInativacao ? String(kpis.inativacoes) : '—'} href="/alunos">
          {!loading && (rastreiaInativacao ? <Delta atual={kpis.inativacoes} anterior={kpis.inativacoesAnt} subiuEhBom={false} /> : <Aux>disponível após a atualização do banco</Aux>)}
        </KpiSecundario>
        <KpiSecundario rotulo="Crescimento líquido" valor={loading ? '...' : `${kpis.crescimento > 0 ? '+' : ''}${kpis.crescimento}`} cor={kpis.crescimento < 0 ? 'text-red-600' : kpis.crescimento > 0 ? 'text-green-700' : 'text-gray-900'}>
          {!loading && <Aux>novos − inativações</Aux>}
        </KpiSecundario>
      </div>

      {/* Atenção gerencial */}
      {!loading && !erro && (
        <section className={`mb-8 rounded-xl border p-4 ${atencao.length ? 'border-amber-200 bg-amber-50/60' : 'border-green-200 bg-green-50/60'}`} aria-label="Atenção gerencial">
          <div className="flex items-center gap-2 mb-2">
            {atencao.length ? <AlertTriangle size={18} className="text-amber-600" /> : <CheckCircle2 size={18} className="text-green-600" />}
            <h2 className="text-sm font-semibold text-gray-900">{atencao.length ? 'Atenção gerencial' : 'Nada pedindo atenção agora'}</h2>
          </div>
          {atencao.length > 0 && (
            <ul className="divide-y divide-amber-100">
              {atencao.map(a => (
                <li key={a.id} className="flex items-center gap-3 py-2 text-sm text-gray-800">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.nivel === 'alto' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="flex-1">{a.texto}</span>
                  {a.href && <Link href={a.href} className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800">Ver <ChevronRight size={14} /></Link>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {semAtivos && !erro && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">Nenhum aluno ativo neste recorte (unidade/modalidade).</div>
      )}

      <TemaRecolhivel titulo="Financeiro" subtitulo="Pelo mês do pagamento. Mostra pelo menos 6 meses, para dar para ver a tendência." filtro={<FiltroPeriodo p={pFin} nome="Financeiro" />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Grafico titulo="Receita recebida por mês" nota={temAnterior ? 'Linha cinza: mesmo mês do período anterior' : undefined}
          carregando={loading} vazio={!loading && financeira.every(l => l.recebida === 0 && l.anterior === 0)} mensagemVazio="Nenhuma receita recebida neste período">
          <ResponsiveContainer width="100%" height={ALTURA}>
            <ComposedChart data={financeira} margin={MARGEM}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis {...eixoY} tickFormatter={brlCurto} />
              <Tooltip formatter={tip} />
              <Legend {...legenda} />
              <Bar dataKey="recebida" name="Recebida" fill={COR.marca} radius={[4, 4, 0, 0]} />
              {temAnterior && <Line type="monotone" dataKey="anterior" name="Período anterior" stroke={COR.anterior} strokeWidth={2} dot={{ r: 3 }} />}
            </ComposedChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Recebido, a vencer e vencido" nota="Soma de cada barra = receita prevista do mês"
          carregando={loading} vazio={!loading && financeira.every(l => l.prevista === 0)} mensagemVazio="Nada recebido nem a receber neste período">
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={financeira} margin={MARGEM}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis {...eixoY} tickFormatter={brlCurto} />
              <Tooltip formatter={tip} />
              <Legend {...legenda} />
              <Bar dataKey="recebida" stackId="p" name="Recebido" fill={COR.recebido} />
              <Bar dataKey="aVencer" stackId="p" name="A vencer" fill={COR.aVencer} />
              <Bar dataKey="vencido" stackId="p" name="Vencido" fill={COR.vencido} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Lucro líquido por mês" nota={`No período: recebido ${brl(totaisPeriodo.bruto)} − despesas pagas ${brl(totaisPeriodo.despesas)} = ${brl(totaisPeriodo.lucro)}${modalidade ? " (unidade toda: despesas não se dividem por modalidade)" : ""}`}
          carregando={loading} vazio={!loading && lucro.every(l => l.bruto === 0 && l.despesas === 0)} mensagemVazio="Sem receitas nem despesas pagas neste período" largo>
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={lucro} margin={MARGEM}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis {...eixoY} tickFormatter={brlCurto} />
              <Tooltip formatter={tip} />
              <Legend {...legenda} />
              <Bar dataKey="despesas" name="Despesas pagas" fill={COR.vencido} radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro líquido" fill={COR.recebido} radius={[4, 4, 0, 0]}>
                {lucro.map(l => <Cell key={l.mes} fill={l.lucro < 0 ? COR.vencido : COR.recebido} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>
      </TemaRecolhivel>

      <TemaRecolhivel titulo="Fluxo de caixa" subtitulo="Por mês: o que entrou e saiu e a previsão dos meses à frente.">
        <FluxoDeCaixa movs={movsFluxo} hoje={hoje} mensalidades={mensalidadesUnidade} carregando={loading} />
      </TemaRecolhivel>

      <TemaRecolhivel titulo="Alunos" subtitulo="Base = alunos ativos no fim de cada mês. Novos cadastros e inativações do mês." filtro={
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <FiltroMeses j={jAlu} nome="Alunos" opcoes={[{ n: 6, nome: '6 meses' }, { n: 12, nome: '1 ano' }]} />
          <div className="inline-flex shrink-0 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-lg border border-gray-200 bg-white" role="group" aria-label="Esporte">
            {[{ id: '', nome: 'Todos' }, ...esportesAlu].map(e => (
              <button key={e.id || 'todos'} type="button" aria-pressed={esporteAlu === e.id} onClick={() => setEsporteAlu(e.id)}
                className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${esporteAlu === e.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{e.nome}</button>
            ))}
          </div>
        </div>
      }>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Grafico titulo="Base de alunos ativos" nota={inativosSemData > 0 ? `${inativosSemData} inativo(s) sem nenhuma data de saída não entram na base` : undefined}
          carregando={loading} vazio={!loading && serieA.every(l => l.base === 0)} mensagemVazio="Nenhum aluno cadastrado até este período">
          <ResponsiveContainer width="100%" height={ALTURA}>
            <LineChart data={serieA} margin={MARGEM}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis {...eixoY} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="base" name="Alunos na base" stroke={COR.base} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Novos alunos × inativações" nota={inativosEstimados > 0 ? `${inativosEstimados} inativação(ões) com data estimada pelo último pagamento (vieram inativos da planilha antiga)` : undefined}
          carregando={loading} vazio={!loading && serieA.every(l => l.novos === 0 && l.inativacoes === 0)} mensagemVazio="Nenhum cadastro nem inativação neste período">
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={serieA} margin={MARGEM}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis {...eixoY} allowDecimals={false} />
              <Tooltip />
              <Legend {...legenda} />
              <Bar dataKey="novos" name="Novos" fill={COR.recebido} radius={[4, 4, 0, 0]} />
              <Bar dataKey="inativacoes" name="Inativações" fill={COR.vencido} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Inativações por mês" nota="Barra clara = data estimada pelo último pagamento (alunos que vieram inativos da planilha antiga)" largo
          carregando={loading} vazio={!loading && inativacoesMes.every(l => l.total === 0)} mensagemVazio="Nenhuma inativação neste período">
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={inativacoesMes} margin={MARGEM}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis {...eixoY} allowDecimals={false} />
              <Tooltip />
              <Legend {...legenda} />
              <Bar dataKey="registrada" stackId="i" name="Data registrada" fill={COR.vencido} />
              <Bar dataKey="estimada" stackId="i" name="Data estimada" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>
      </TemaRecolhivel>

      <TemaRecolhivel titulo="Vendas de produtos" subtitulo="Estoque: quanto foi vendido por mês.">
        <VendasDeProdutos hoje={hoje} />
      </TemaRecolhivel>

      <TemaRecolhivel titulo="Modalidades" subtitulo="Alunos ativos de hoje. O aluno em combo conta nas duas unidades; quem tem mais de uma modalidade entra em cada uma." filtro={<FiltroPeriodo p={pMod} nome="Modalidades" />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Grafico titulo="Alunos por modalidade e esporte" largo
          carregando={loading} vazio={!loading && porModalidade.dados.length === 0} mensagemVazio="Nenhuma matrícula ativa neste recorte">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-full md:w-2/3">
              <ResponsiveContainer width="100%" height={ALTURA}>
                <BarChart data={porModalidade.dados} margin={MARGEM}>
                  <Grade />
                  <XAxis dataKey="modalidade" {...eixoX} />
                  <YAxis {...eixoY} allowDecimals={false} />
                  <Tooltip />
                  <Legend {...legenda} />
                  {porModalidade.esportes.map(e => <Bar key={e} dataKey={e} stackId="m" fill={corEsporte(e)} name={e} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full md:w-1/3 space-y-2 text-sm">
              {fatiasModalidade.map(f => (
                <li key={f.modalidade} className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0">
                  <span className="text-gray-800">{f.modalidade}</span>
                  <span className="text-gray-600"><strong className="text-gray-900">{f.total}</strong> · {pct(f.pct)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Grafico>
        <Grafico titulo="Faturamento por professor (por esporte)" nota="Entradas recebidas no período, vinculadas ao professor"
          carregando={loading} vazio={!loading && porProfessor.dados.length === 0} mensagemVazio="Nenhuma entrada vinculada a professor neste período"
          altura={Math.max(ALTURA - 20, porProfessor.dados.length * 44 + 70)} largo>
          <ResponsiveContainer width="100%" height={Math.max(ALTURA - 20, porProfessor.dados.length * 44 + 70)}>
            <BarChart data={porProfessor.dados} layout="vertical" margin={{ ...MARGEM, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickFormatter={brlCurto} tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis type="category" dataKey="professor" width={90} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={tip} />
              <Legend {...legenda} />
              {porProfessor.esportes.map(e => <Bar key={e} dataKey={e} stackId="p" fill={corEsporte(e)} name={e} />)}
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>
      </TemaRecolhivel>

      <TemaRecolhivel titulo="Pagamentos" subtitulo="Pagos e cancelados são do período; a vencer e vencidos são a carteira em aberto de hoje." filtro={<FiltroPeriodo p={pPag} nome="Pagamentos" />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Grafico titulo="Situação dos pagamentos"
          carregando={loading} vazio={!loading && status.every(s => s.qtd === 0)} mensagemVazio="Nenhum pagamento neste período">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height={ALTURA - 20}>
                <PieChart>
                  <Pie data={status.filter(s => s.qtd > 0)} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={88} paddingAngle={2}>
                    {status.filter(s => s.qtd > 0).map(s => <Cell key={s.nome} fill={COR_STATUS[s.nome]} />)}
                  </Pie>
                  <Tooltip formatter={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full sm:w-1/2 space-y-2 text-sm">
              {status.map(s => (
                <li key={s.nome} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: COR_STATUS[s.nome] }} />{s.nome}</span>
                  <span className="text-gray-700">{s.qtd} · {brl(s.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Grafico>
        <Grafico titulo="Faixas de atraso" nota="Dias desde o vencimento, só do que está vencido e em aberto"
          carregando={loading} vazio={!loading && faixas.every(f => f.qtd === 0)} mensagemVazio="Nenhuma cobrança vencida em aberto">
          <ResponsiveContainer width="100%" height={ALTURA - 40}>
            <BarChart data={faixas} margin={MARGEM}>
              <Grade />
              <XAxis dataKey="faixa" {...eixoX} />
              <YAxis {...eixoY} tickFormatter={brlCurto} />
              <Tooltip formatter={(v, nome) => (nome === 'Valor em atraso' ? tip(v) : String(v))} />
              <Bar dataKey="valor" name="Valor em atraso" fill={COR.vencido} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {!loading && (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
              {faixas.map(f => <li key={f.faixa}>{f.faixa}: {f.qtd} cobrança{f.qtd === 1 ? '' : 's'}</li>)}
            </ul>
          )}
        </Grafico>
      </div>
      </TemaRecolhivel>

      <section className="mb-6">
        <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-gray-700">
          <Info size={18} className="shrink-0 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-950 mb-1">Frequência, horários mais procurados e ocupação de quadras ainda não aparecem.</p>
            <p>O sistema não registra presença, horário das aulas nem reservas de quadra. Para esses gráficos seria preciso cadastrar turmas (dia, horário e capacidade), a presença por aula e as reservas. Não mostro números inventados no lugar.</p>
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-500">
        Fórmulas: recebida = entradas com status Recebido pela data do pagamento; prevista = recebida + a receber que vence no período; vencido = a receber com vencimento anterior a hoje;
        inadimplência = alunos ativos com cobrança vencida em aberto ou vencimento do cadastro passado ÷ alunos ativos; crescimento = novos − inativações; ticket médio = recebido de alunos ÷ alunos
        que pagaram em cada mês; gastos = saídas pagas no período pela data do pagamento (sempre da unidade toda, sem filtro de modalidade). Valores da unidade escolhida no menu.
      </p>
    </div>
  )
}
