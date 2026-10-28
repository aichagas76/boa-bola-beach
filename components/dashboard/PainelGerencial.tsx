'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Info, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import dynamic from 'next/dynamic'
import { brl, pct } from '@/components/dashboard/painel-ui'
import { despesasPorCategoria, faturamentoProfessores, mesesEntre, serieMensal, type Evento } from '@/lib/painel-graficos'
import { FiltroMeses, FiltroPeriodo, PRESETS, TemaRecolhivel, useJanela, usePeriodo } from '@/components/dashboard/FiltroPeriodo'
import type { MovFluxo } from '@/lib/fluxo-caixa'
import {
  alunosDaModalidade, aparaMesesVazios, calcularKpis, faixasDeAtraso, gastosDoPeriodo, itensFinanceiros, mesesDaJanela,
  participacao, periodoDe, pontosDeAtencao, serieAlunosAtivos, serieFinanceira, statusDosPagamentos, ticketMedio, variacao,
  type AlunoP, type MatP, type MovP, type PagP, type Preset,
} from '@/lib/painel'
import {
  alunosPorModalidade, resumoPorMes, totaisDoPeriodo,
  type Mov,
} from '@/lib/relatorios'

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


type LinhaAluno = { id: string; status: string | null; data_cadastro: string | null; data_inativacao?: string | null; data_vencimento: string | null; unidade_id: string | null }
type LinhaMat = { aluno_id: string; tipo: string; valor: number | null; unidade_id: string | null; acesso_duas_unidades: boolean | null; esporte_id: string | null; esportes: { nome: string } | null }
type LinhaMov = {
  id: string; tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null; data_vencimento: string | null
  aluno_ref_id: string | null; professor_id: string | null; professores: { nome: string } | null; esportes: { nome: string } | null
  conta_bancaria_id: string | null; contas_bancarias: { nome: string } | null
  categorias_financeiro: { categoria: string | null } | null
}

// Os gráficos ficam em arquivos à parte, carregados só quando um tema abre (a biblioteca de gráficos não pesa na entrada)
const carregandoGraficos = () => <div className="py-8 text-center text-sm text-gray-400">Carregando gráficos...</div>
const GraficosFinanceiro = dynamic(() => import('@/components/dashboard/GraficosDosTemas').then(m => m.GraficosFinanceiro), { ssr: false, loading: carregandoGraficos })
const GraficosAlunos = dynamic(() => import('@/components/dashboard/GraficosDosTemas').then(m => m.GraficosAlunos), { ssr: false, loading: carregandoGraficos })
const GraficosModalidades = dynamic(() => import('@/components/dashboard/GraficosDosTemas').then(m => m.GraficosModalidades), { ssr: false, loading: carregandoGraficos })
const GraficosPagamentos = dynamic(() => import('@/components/dashboard/GraficosDosTemas').then(m => m.GraficosPagamentos), { ssr: false, loading: carregandoGraficos })
const FluxoDeCaixa = dynamic(() => import('@/components/dashboard/FluxoDeCaixa'), { ssr: false, loading: carregandoGraficos })
const VendasDeProdutos = dynamic(() => import('@/components/dashboard/GraficosProdutosAlunos').then(m => m.VendasDeProdutos), { ssr: false, loading: carregandoGraficos })

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
  const jMod = useJanela(hoje, 6)
  const [profSel, setProfSel] = useState('')
  const pPag = usePeriodo(hoje)
  // Só o que está à vista é calculado: cada tema começa fechado e só entra na conta quando aberto
  const [aberto, setAberto] = useState<Record<string, boolean>>({})
  const alternar = (id: string) => () => setAberto(a => ({ ...a, [id]: !a[id] }))
  const abFin = !!aberto.fin, abFlu = !!aberto.flu, abAlu = !!aberto.alu, abMod = !!aberto.mod, abPag = !!aberto.pag

  const [loading, setLoading] = useState(true)
  const [detalhesOk, setDetalhesOk] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rastreiaInativacao, setRastreiaInativacao] = useState(true)
  const [alunos, setAlunos] = useState<LinhaAluno[]>([])
  const [mats, setMats] = useState<LinhaMat[]>([])
  const [movs, setMovs] = useState<LinhaMov[]>([])
  const [pags, setPags] = useState<PagP[]>([])
  // Quando cada aluno foi inativado (registrada ou estimada), para a base de alunos ativos
  const [saidas, setSaidas] = useState<Record<string, string>>({})
  // Reativações (inativo -> ativo) registradas pelo sistema
  const [reativacoes, setReativacoes] = useState<{ aluno_id: string; data: string }[]>([])
  const [esporteAlu, setEsporteAlu] = useState('')

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setLoading(true)
      setDetalhesOk(false)
      setErro(null)
      const corte = `${new Date().getFullYear() - 2}-01-01`

      // data_inativacao só existe depois da atualização do banco: se faltar, o painel segue sem ela
      let rastreia = true
      const [ra0, rm, rf, rp, rh, rr] = await Promise.all([
        buscarTudo((de, ate) => supabase.from('alunos').select('id, status, data_cadastro, data_inativacao, data_vencimento, unidade_id').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('matriculas').select('aluno_id, tipo, valor, unidade_id, acesso_duas_unidades, esporte_id, esportes(nome)').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase
          .from('movimentacoes')
          .select('id, tipo, status, valor, data, data_pagamento, data_vencimento, aluno_ref_id')
          .eq('unidade_id', unidadeId)
          .or(`data.gte.${corte},data_pagamento.gte.${corte},status.neq.Recebido`)
          .order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('pagamentos').select('aluno_id, valor, status, data_vencimento').neq('status', 'Pago').order('id').range(de, ate)),
        // Se a tabela do histórico ainda não existir no banco, o gráfico segue só com as datas registradas
        buscarTudo((de, ate) => supabase.from('alunos_status_historico').select('aluno_id, data').eq('para_status', 'Inativo').order('data').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('alunos_status_historico').select('aluno_id, data').eq('de_status', 'Inativo').eq('para_status', 'Ativo').order('data').order('id').range(de, ate)),
      ])
      let ra = ra0
      if (ra.error) {
        rastreia = false
        ra = await buscarTudo((de, ate) => supabase.from('alunos').select('id, status, data_cadastro, data_vencimento, unidade_id').order('id').range(de, ate)) as typeof ra
      }
      if (cancelado) return
      if (ra.error || rm.error || rf.error || rp.error) {
        setErro('Não consegui carregar os dados do painel. Atualize a página; se continuar, avise o suporte.')
        setLoading(false)
        return
      }
      setRastreiaInativacao(rastreia)
      setAlunos((ra.data ?? []) as unknown as LinhaAluno[])
      setMats((rm.data ?? []) as unknown as LinhaMat[])
      setMovs(((rf.data ?? []) as unknown as Pick<LinhaMov, 'id' | 'tipo' | 'status' | 'valor' | 'data' | 'data_pagamento' | 'data_vencimento' | 'aluno_ref_id'>[]).map(m => ({
        ...m, professor_id: null, professores: null, esportes: null, conta_bancaria_id: null, contas_bancarias: null, categorias_financeiro: null,
      })))
      setPags((rp.data ?? []) as PagP[])
      setReativacoes(rr.error ? [] : ((rr.data ?? []) as unknown as { aluno_id: string; data: string }[]))
      setSaidas(rh.error ? {} : Object.fromEntries(((rh.data ?? []) as unknown as { aluno_id: string; data: string }[]).map(x => [x.aluno_id, x.data])))
      setLoading(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId])

  // Professor, esporte, conta e categoria dos lançamentos: só buscados quando um tema que usa abre (Financeiro, Fluxo de caixa, Modalidades)
  const precisaDetalhes = !!aberto.fin || !!aberto.flu || !!aberto.mod
  useEffect(() => {
    if (!unidadeId || loading || !precisaDetalhes || detalhesOk) return
    let cancelado = false
    async function carregarDetalhes() {
      const [rd, dProf, dEsp, dConta, dCat] = await Promise.all([
        buscarTudo((de, ate) => supabase.from('movimentacoes').select('id, professor_id, esporte_id, conta_bancaria_id, categoria_id')
          .eq('unidade_id', unidadeId).or(`data.gte.${new Date().getFullYear() - 2}-01-01,data_pagamento.gte.${new Date().getFullYear() - 2}-01-01,status.neq.Recebido`).order('id').range(de, ate)),
        supabase.from('professores').select('id, nome'),
        supabase.from('esportes').select('id, nome'),
        supabase.from('contas_bancarias').select('id, nome'),
        supabase.from('categorias_financeiro').select('id, categoria'),
      ])
      if (cancelado) return
      if (rd.error) { setErro('Não consegui carregar os detalhes dos lançamentos. Atualize a página.'); return }
      const nomes = (r: { data: { id: string; nome?: string; categoria?: string }[] | null }, campo: 'nome' | 'categoria') => new Map((r.data ?? []).map(x => [x.id, x[campo] ?? null]))
      const nProf = nomes(dProf, 'nome'), nEsp = nomes(dEsp, 'nome'), nConta = nomes(dConta, 'nome'), nCat = nomes(dCat, 'categoria')
      const por = new Map(((rd.data ?? []) as unknown as { id: string; professor_id: string | null; esporte_id: string | null; conta_bancaria_id: string | null; categoria_id: string | null }[]).map(x => [x.id, x]))
      setMovs(antes => antes.map(m => {
        const d = por.get(m.id)
        if (!d) return m
        return {
          ...m,
          professor_id: d.professor_id, conta_bancaria_id: d.conta_bancaria_id,
          professores: d.professor_id && nProf.get(d.professor_id) ? { nome: nProf.get(d.professor_id)! } : null,
          esportes: d.esporte_id && nEsp.get(d.esporte_id) ? { nome: nEsp.get(d.esporte_id)! } : null,
          contas_bancarias: d.conta_bancaria_id && nConta.get(d.conta_bancaria_id) ? { nome: nConta.get(d.conta_bancaria_id)! } : null,
          categorias_financeiro: d.categoria_id && nCat.get(d.categoria_id) ? { categoria: nCat.get(d.categoria_id)! } : null,
        }
      }))
      setDetalhesOk(true)
    }
    carregarDetalhes()
    return () => { cancelado = true }
  }, [unidadeId, loading, precisaDetalhes, detalhesOk])
  // Enquanto os detalhes não chegam, esses temas mostram "Carregando..." em vez de gráfico incompleto
  const loadingDet = loading || (precisaDetalhes && !detalhesOk)

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
    () => (abFin ? aparaMesesVazios(serieFinanceira(itens, mesesFin, hoje), l => l.recebida > 0 || l.anterior > 0 || l.aReceber > 0) : []),
    [abFin, itens, mesesFin, hoje]
  )
  const temAnterior = financeira.some(l => l.anterior > 0)
  // Esporte escolhido no tema Alunos: só quem tem matrícula nele
  const esportesAlu = useMemo(() => {
    if (!abAlu) return []
    const por = new Map<string, string>()
    for (const m of dados.matsU) if (m.esporte_id && m.esportes?.nome) por.set(m.esporte_id, m.esportes.nome)
    return [...por.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [abAlu, dados.matsU])
  const alunosDoGrafico = useMemo(() => {
    if (!abAlu) return []
    const doEsporte = esporteAlu ? new Set(dados.matsU.filter(m => m.esporte_id === esporteAlu).map(m => m.aluno_id)) : null
    return alunosP
      .filter(a => !doEsporte || doEsporte.has(a.id))
      .map(a => (a.status === 'Inativo' && !a.data_inativacao && saidas[a.id] ? { ...a, data_inativacao: saidas[a.id] } : a))
  }, [abAlu, alunosP, dados.matsU, esporteAlu, saidas])
  const inativacoesMes = useMemo(() => {
    if (!abAlu) return []
    const doEsporte = esporteAlu ? new Set(dados.matsU.filter(m => m.esporte_id === esporteAlu).map(m => m.aluno_id)) : null
    const eventos: Evento[] = []
    for (const a of alunosP) {
      if (doEsporte && !doEsporte.has(a.id)) continue
      if (a.data_inativacao) eventos.push({ data: a.data_inativacao, grupo: 'registrada' })
      else if (a.status === 'Inativo' && saidas[a.id]) eventos.push({ data: saidas[a.id], grupo: 'estimada' })
    }
    return serieMensal(eventos, jAlu.janela, ['registrada', 'estimada'])
  }, [abAlu, alunosP, dados.matsU, esporteAlu, saidas, jAlu.janela])
  // Novos alunos do mês: cadastros novos (nunca existiram) e reativados (voltaram de inativo)
  const novosMes = useMemo(() => {
    if (!abAlu) return []
    const doEsporte = esporteAlu ? new Set(dados.matsU.filter(m => m.esporte_id === esporteAlu).map(m => m.aluno_id)) : null
    const ids = new Set(alunosP.map(a => a.id))
    const reativ = serieMensal(reativacoes.filter(r => ids.has(r.aluno_id) && (!doEsporte || doEsporte.has(r.aluno_id))).map<Evento>(r => ({ data: r.data })), jAlu.janela)
    return serieAlunosAtivos(alunosDoGrafico, mesesAlu, hoje).map((l, i) => ({ rotulo: l.rotulo, novos: l.novos, reativados: Number(reativ[i]?.total ?? 0) }))
  }, [abAlu, alunosP, alunosDoGrafico, dados.matsU, esporteAlu, reativacoes, jAlu.janela, mesesAlu, hoje])
  const serieA = useMemo(() => (abAlu ? serieAlunosAtivos(alunosDoGrafico, mesesAlu, hoje) : []), [abAlu, alunosDoGrafico, mesesAlu, hoje])
  const status = useMemo(() => (abPag ? statusDosPagamentos(itens, pPag.periodo, hoje) : []), [abPag, itens, pPag.periodo, hoje])
  const faixas = useMemo(() => (abPag ? faixasDeAtraso(itens, hoje) : []), [abPag, itens, hoje])

  const mesesPeriodoFin = useMemo(() => mesesDaJanela(pFin.periodo.inicio, pFin.periodo.fim, 1), [pFin.periodo])
  // O lucro usa todas as movimentações da unidade (despesas não pertencem a uma modalidade)
  const movsRelUnidade: Mov[] = useMemo(() => (!abFin ? [] : movs.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento,
    professor_id: m.professor_id, professor_nome: m.professores?.nome ?? null, esporte_nome: m.esportes?.nome ?? null,
  }))), [abFin, movs])
  const movsFluxo: MovFluxo[] = useMemo(() => (!abFlu ? [] : movs.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento, data_vencimento: m.data_vencimento, conta_id: m.conta_bancaria_id,
  }))), [abFlu, movs])
  // Mensalidades dos alunos ativos da unidade toda (o caixa não se divide por modalidade)
  const mensalidadesUnidade = useMemo(() => {
    if (!abFlu) return 0
    const ativos = new Set(dados.alunosU.filter(a => a.status === 'Ativo').map(a => a.id))
    return Math.round(dados.matsU.filter(m => ativos.has(m.aluno_id)).reduce((t, m) => t + (Number(m.valor) || 0), 0) * 100) / 100
  }, [abFlu, dados.alunosU, dados.matsU])
  // Despesas pagas por categoria, no período escolhido no Financeiro (a unidade toda: despesa não é de modalidade)
  // Clicar numa categoria (na lista ou na fatia) tira ela do cálculo; clicar de novo traz de volta
  const [categoriasOcultas, setCategoriasOcultas] = useState<string[]>([])
  const movsDespesa = useMemo(() => (!abFin ? [] : movs.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento, categoria: m.categorias_financeiro?.categoria ?? null,
  }))), [abFin, movs])
  const despesasCat = useMemo(() => despesasPorCategoria(movsDespesa, { inicio: pFin.periodo.inicio, fim: pFin.periodo.fim }, 8, categoriasOcultas), [movsDespesa, pFin.periodo, categoriasOcultas])
  const despesasOcultas = useMemo(() => despesasPorCategoria(movsDespesa, { inicio: pFin.periodo.inicio, fim: pFin.periodo.fim }, 99).filter(d => categoriasOcultas.includes(d.name)), [movsDespesa, pFin.periodo, categoriasOcultas])
  const alternarCategoria = (nome: string) => { if (nome !== 'Outras') setCategoriasOcultas(l => (l.includes(nome) ? l.filter(x => x !== nome) : [...l, nome])) }
  const totalDespesasCat = despesasCat.reduce((t, d) => t + d.value, 0)
  const lucro = useMemo(
    () => (abFin ? aparaMesesVazios(resumoPorMes(movsRelUnidade, mesesFin), l => l.bruto > 0 || l.despesas > 0) : []),
    [abFin, movsRelUnidade, mesesFin]
  )
  const totaisPeriodo = useMemo(() => (abFin ? totaisDoPeriodo(resumoPorMes(movsRelUnidade, mesesPeriodoFin)) : { bruto: 0, despesas: 0, lucro: 0 }), [abFin, movsRelUnidade, mesesPeriodoFin])
  // Faturamento dos professores: ranking do período e, mês a mês, o valor e os alunos que pagaram
  const movsProf = useMemo(() => (!abMod ? [] : dados.movsF.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento,
    professor_id: m.professor_id, professor_nome: m.professores?.nome ?? null, esporte_nome: m.esportes?.nome ?? null, aluno_ref_id: m.aluno_ref_id,
  }))), [abMod, dados.movsF])
  const fatProf = useMemo(() => faturamentoProfessores(movsProf, jMod.janela, profSel), [movsProf, jMod.janela, profSel])
  const professoresFat = useMemo(() => {
    const por = new Map<string, string>()
    for (const m of movsProf) if (m.professor_id && m.professor_nome && m.tipo === 'Entrada' && m.status === 'Recebido') por.set(m.professor_id, m.professor_nome)
    return [...por.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [movsProf])
  const nomeProfSel = professoresFat.find(x => x.id === profSel)?.nome

  const matsRel = useMemo(() => (!abMod ? [] : dados.matsF.map(m => ({
    aluno_id: m.aluno_id, tipo: m.tipo, unidade_id: m.unidade_id, acesso_duas_unidades: m.acesso_duas_unidades, esporte_nome: m.esportes?.nome ?? null,
  }))), [abMod, dados.matsF])
  const porModalidade = useMemo(() => (abMod ? alunosPorModalidade(dados.alunosF.map(a => ({ id: a.id, status: a.status })), matsRel, unidadeId) : { dados: [], esportes: [] }), [abMod, dados.alunosF, matsRel, unidadeId])
  const fatiasModalidade = useMemo(() => participacao(porModalidade.dados), [porModalidade])

  const modalidadesDisponiveis = useMemo(() => Array.from(new Set(dados.matsU.map(m => m.tipo))).sort(), [dados.matsU])
  const inativosSemData = useMemo(() => alunosDoGrafico.filter(a => a.status === 'Inativo' && !a.data_inativacao).length, [alunosDoGrafico])

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

      <TemaRecolhivel aberto={abFin} onAlternar={alternar('fin')} titulo="Financeiro" subtitulo="Pelo mês do pagamento. Mostra pelo menos 6 meses, para dar para ver a tendência." filtro={<FiltroPeriodo p={pFin} nome="Financeiro" />}>
      <GraficosFinanceiro financeira={financeira} temAnterior={temAnterior} lucro={lucro} totaisPeriodo={totaisPeriodo} modalidade={modalidade} despesasCat={despesasCat} despesasOcultas={despesasOcultas} totalDespesasCat={totalDespesasCat} alternarCategoria={alternarCategoria} pFin={pFin} loadingDet={loadingDet} />
      </TemaRecolhivel>

      <TemaRecolhivel aberto={abFlu} onAlternar={alternar('flu')} titulo="Fluxo de caixa" subtitulo="Por mês: o que entrou e saiu e a previsão dos meses à frente.">
        <FluxoDeCaixa movs={movsFluxo} hoje={hoje} mensalidades={mensalidadesUnidade} carregando={loadingDet} />
      </TemaRecolhivel>

      <TemaRecolhivel aberto={abAlu} onAlternar={alternar('alu')} titulo="Alunos" subtitulo="Base = alunos ativos no fim de cada mês. Novos cadastros e inativações do mês." filtro={
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
      <GraficosAlunos loading={loading} serieA={serieA} novosMes={novosMes} inativacoesMes={inativacoesMes} inativosSemData={inativosSemData} />
      </TemaRecolhivel>

      <TemaRecolhivel titulo="Vendas de produtos" subtitulo="Estoque: quanto foi vendido por mês.">
        <VendasDeProdutos hoje={hoje} />
      </TemaRecolhivel>

      <TemaRecolhivel aberto={abMod} onAlternar={alternar('mod')} titulo="Modalidades" subtitulo="Alunos ativos de hoje (aluno em combo conta nas duas unidades) e o faturamento dos professores no período."
        filtro={<FiltroMeses j={jMod} nome="Modalidades" opcoes={[{ n: 1, nome: 'Mês atual' }, { n: 3, nome: '3 meses' }, { n: 6, nome: '6 meses' }, { n: 12, nome: '1 ano' }]} />}>
      <GraficosModalidades loadingDet={loadingDet} porModalidade={porModalidade} fatiasModalidade={fatiasModalidade} fatProf={fatProf} profSel={profSel} setProfSel={setProfSel} professoresFat={professoresFat} nomeProfSel={nomeProfSel} />
      </TemaRecolhivel>

      <TemaRecolhivel aberto={abPag} onAlternar={alternar('pag')} titulo="Pagamentos" subtitulo="Pagos e cancelados são do período; a vencer e vencidos são a carteira em aberto de hoje." filtro={<FiltroPeriodo p={pPag} nome="Pagamentos" />}>
      <GraficosPagamentos loading={loading} status={status} faixas={faixas} />
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
