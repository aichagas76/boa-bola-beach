'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import {
  alunosDaModalidade, calcularKpis, faixasDeAtraso, itensFinanceiros, mesesDaJanela, participacao, periodoDe,
  serieAlunos, serieFinanceira, statusDosPagamentos, variacao,
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

/* ---------- cores com significado fixo ---------- */
const COR = {
  recebido: '#16A34A', marca: '#7DC421', aReceber: '#F59E0B', vencido: '#DC2626',
  anterior: '#9CA3AF', base: '#2563EB', cancelado: '#6B7280',
}
const COR_ESPORTE: Record<string, string> = {
  'Beach Tênis': '#F97316', 'Tênis': '#84A60F', Padel: '#2563EB', Pickleball: '#EAB308', 'Sem esporte': '#9CA3AF',
}
const corEsporte = (n: string) => COR_ESPORTE[n] ?? '#6B7280'
const CORES_MODALIDADE = ['#7DC421', '#2563EB', '#F59E0B', '#8B5CF6', '#14B8A6', '#EC4899']

const PRESETS: { id: Preset; nome: string }[] = [
  { id: 'mes_atual', nome: 'Mês atual' },
  { id: 'mes_anterior', nome: 'Mês anterior' },
  { id: '3m', nome: '3 meses' },
  { id: '6m', nome: '6 meses' },
  { id: 'custom', nome: 'Personalizado' },
]

/* ---------- peças visuais ---------- */
function Delta({ atual, anterior, subiuEhBom = true }: { atual: number; anterior: number; subiuEhBom?: boolean }) {
  const v = variacao(atual, anterior)
  if (v === null) return <span className="text-xs text-gray-400">sem base de comparação</span>
  if (Math.abs(v) < 0.05) return <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Minus size={12} /> igual ao período anterior</span>
  const bom = (v > 0) === subiuEhBom
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${bom ? 'text-green-700' : 'text-red-600'}`}>
      {v > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {pct(Math.abs(v))} <span className="font-normal text-gray-500">vs. período anterior</span>
    </span>
  )
}

function CartaoKpi({ rotulo, valor, children, href, destaque }: { rotulo: string; valor: string; children?: React.ReactNode; href?: string; destaque?: string }) {
  const corpo = (
    <div className={`h-full bg-white border border-gray-200 rounded-xl p-4 ${href ? 'hover:border-gray-300 hover:shadow-sm transition' : ''}`}>
      <div className="text-sm text-gray-600 mb-1">{rotulo}</div>
      <div className={`text-kpi ${destaque ?? 'text-gray-900'}`}>{valor}</div>
      <div className="mt-1.5 min-h-[1.25rem]">{children}</div>
    </div>
  )
  return href ? <Link href={href} className="block h-full">{corpo}</Link> : corpo
}

function Secao({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-section-title text-gray-900">{titulo}</h2>
        {subtitulo && <p className="text-sm text-gray-500">{subtitulo}</p>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

function Grafico({ titulo, nota, vazio, carregando, altura = 260, children, largo }: { titulo: string; nota?: string; vazio?: boolean; carregando?: boolean; altura?: number; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${largo ? 'lg:col-span-2' : ''}`}>
      <div className="text-sm font-semibold text-gray-900">{titulo}</div>
      {nota && <div className="text-xs text-gray-500 mb-2">{nota}</div>}
      <div className="mt-2" style={{ minHeight: altura }}>
        {carregando ? (
          <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: altura }}>Carregando...</div>
        ) : vazio ? (
          <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: altura }}>Sem dados neste período</div>
        ) : children}
      </div>
    </div>
  )
}

type LinhaAluno = { id: string; status: string | null; data_cadastro: string | null; data_inativacao?: string | null; data_vencimento: string | null; unidade_id: string | null }
type LinhaMat = { aluno_id: string; tipo: string; valor: number | null; unidade_id: string | null; acesso_duas_unidades: boolean | null; esportes: { nome: string } | null }
type LinhaMov = {
  tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null; data_vencimento: string | null
  aluno_ref_id: string | null; professor_id: string | null; professores: { nome: string } | null; esportes: { nome: string } | null
}

export default function PainelGerencial() {
  const { unidadeId, unidade } = useUnidade()
  const hoje = useMemo(() => new Date().toLocaleDateString('en-CA'), [])

  const [preset, setPreset] = useState<Preset>('mes_atual')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [modalidade, setModalidade] = useState('')

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rastreiaInativacao, setRastreiaInativacao] = useState(true)
  const [alunos, setAlunos] = useState<LinhaAluno[]>([])
  const [mats, setMats] = useState<LinhaMat[]>([])
  const [movs, setMovs] = useState<LinhaMov[]>([])
  const [pags, setPags] = useState<PagP[]>([])

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setLoading(true)
      setErro(null)
      const corte = `${new Date().getFullYear() - 2}-01-01`

      // data_inativacao só existe depois da atualização do banco: se faltar, o painel segue sem ela
      let rastreia = true
      let ra = await supabase.from('alunos').select('id, status, data_cadastro, data_inativacao, data_vencimento, unidade_id')
      if (ra.error) {
        rastreia = false
        ra = await supabase.from('alunos').select('id, status, data_cadastro, data_vencimento, unidade_id') as typeof ra
      }
      const [rm, rf, rp] = await Promise.all([
        supabase.from('matriculas').select('aluno_id, tipo, valor, unidade_id, acesso_duas_unidades, esportes(nome)'),
        supabase
          .from('movimentacoes')
          .select('tipo, status, valor, data, data_pagamento, data_vencimento, aluno_ref_id, professor_id, professores(nome), esportes(nome)')
          .eq('unidade_id', unidadeId)
          .or(`data.gte.${corte},data_pagamento.gte.${corte},status.neq.Recebido`)
          .limit(10000),
        supabase.from('pagamentos').select('aluno_id, valor, status, data_vencimento').neq('status', 'Pago'),
      ])
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
  const meses = useMemo(() => mesesDaJanela(periodo.inicio, periodo.fim, 6), [periodo])

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
  const financeira = useMemo(() => serieFinanceira(itens, meses), [itens, meses])
  const serieA = useMemo(() => serieAlunos(alunosP, meses), [alunosP, meses])
  const status = useMemo(() => statusDosPagamentos(itens, periodo, hoje), [itens, periodo, hoje])
  const faixas = useMemo(() => faixasDeAtraso(itens, hoje), [itens, hoje])

  const movsRel: Mov[] = useMemo(() => dados.movsF.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento,
    professor_id: m.professor_id, professor_nome: m.professores?.nome ?? null, esporte_nome: m.esportes?.nome ?? null,
  })), [dados.movsF])
  const mesesPeriodo = useMemo(() => mesesDaJanela(periodo.inicio, periodo.fim, 1), [periodo])
  const lucro = useMemo(() => resumoPorMes(movsRel, meses), [movsRel, meses])
  const totaisPeriodo = useMemo(() => totaisDoPeriodo(resumoPorMes(movsRel, mesesPeriodo)), [movsRel, mesesPeriodo])
  const porProfessor = useMemo(() => faturamentoPorProfessor(movsRel, mesesPeriodo), [movsRel, mesesPeriodo])

  const matsRel = useMemo(() => dados.matsF.map(m => ({
    aluno_id: m.aluno_id, tipo: m.tipo, unidade_id: m.unidade_id, acesso_duas_unidades: m.acesso_duas_unidades, esporte_nome: m.esportes?.nome ?? null,
  })), [dados.matsF])
  const porModalidade = useMemo(() => alunosPorModalidade(dados.alunosF.map(a => ({ id: a.id, status: a.status })), matsRel, unidadeId), [dados.alunosF, matsRel, unidadeId])
  const fatiasModalidade = useMemo(() => participacao(porModalidade.dados), [porModalidade])

  const modalidadesDisponiveis = useMemo(() => Array.from(new Set(dados.matsU.map(m => m.tipo))).sort(), [dados.matsU])
  const inativosSemData = useMemo(() => alunosP.filter(a => a.status === 'Inativo' && !a.data_inativacao).length, [alunosP])

  const semAtivos = !loading && kpis.alunosAtivos === 0
  const rotuloPeriodo = periodo.inicio === periodo.fim ? periodo.inicio : `${periodo.inicio.split('-').reverse().join('/')} a ${periodo.fim.split('-').reverse().join('/')}`

  return (
    <div>
      {/* Cabeçalho e filtros */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div className="pl-12 md:pl-0">
          <h1 className="text-page-title text-gray-900">Painel</h1>
          <p className="text-sm text-gray-500">{unidade?.nome ?? ''} · {rotuloPeriodo}{modalidade ? ` · ${modalidade === 'Aula' ? 'Aulas' : modalidade}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex max-w-[calc(100vw-2rem)] overflow-x-auto rounded-lg border border-gray-200 bg-white">
            {PRESETS.map(p => (
              <button key={p.id} type="button" onClick={() => setPreset(p.id)}
                className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${preset === p.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {p.nome}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="date" value={de} max={hoje} onChange={e => setDe(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="De" />
              até
              <input type="date" value={ate} max={hoje} onChange={e => setAte(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="Até" />
            </div>
          )}
          <select value={modalidade} onChange={e => setModalidade(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="Modalidade">
            <option value="">Todas as modalidades</option>
            {modalidadesDisponiveis.map(m => <option key={m} value={m}>{m === 'Aula' ? 'Aulas' : m}</option>)}
          </select>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {preset === 'custom' && (!de || !ate) && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Escolha as duas datas do intervalo. Enquanto isso, o painel mostra o dia de hoje.</div>
      )}

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <CartaoKpi rotulo="Alunos ativos" valor={loading ? '...' : String(kpis.alunosAtivos)} href="/alunos">
          <span className="text-xs text-gray-500">{loading ? '' : `Mensalidades somam ${brl(kpis.potencialMensal)}`}</span>
        </CartaoKpi>
        <CartaoKpi rotulo="Receita recebida" valor={loading ? '...' : brl(kpis.recebida)} href="/financeiro" destaque="text-green-700">
          {!loading && <Delta atual={kpis.recebida} anterior={kpis.recebidaAnt} />}
        </CartaoKpi>
        <CartaoKpi rotulo="Receita prevista" valor={loading ? '...' : brl(kpis.prevista)} href="/contas-receber">
          {!loading && <Delta atual={kpis.prevista} anterior={kpis.previstaAnt} />}
        </CartaoKpi>
        <CartaoKpi rotulo="Pagamentos pendentes" valor={loading ? '...' : brl(kpis.abertoValor)} href="/pagamentos" destaque="text-amber-600">
          <span className="text-xs text-gray-500">{loading ? '' : `${kpis.abertoQtd} em aberto · ${kpis.vencidoQtd} vencido${kpis.vencidoQtd === 1 ? '' : 's'}`}</span>
        </CartaoKpi>
        <CartaoKpi rotulo="Inadimplência" valor={loading ? '...' : kpis.inadimplenciaPct === null ? '—' : pct(kpis.inadimplenciaPct)} href="/atraso" destaque={kpis.inadimplentes > 0 ? 'text-red-600' : 'text-gray-900'}>
          <span className="text-xs text-gray-500">{loading ? '' : `${kpis.inadimplentes} de ${kpis.alunosAtivos} alunos ativos`}</span>
        </CartaoKpi>
        <CartaoKpi rotulo="Novos alunos" valor={loading ? '...' : String(kpis.novos)} href="/alunos">
          {!loading && <Delta atual={kpis.novos} anterior={kpis.novosAnt} />}
        </CartaoKpi>
        <CartaoKpi rotulo="Inativações" valor={loading ? '...' : rastreiaInativacao ? String(kpis.inativacoes) : '—'} href="/alunos">
          {!loading && (rastreiaInativacao ? <Delta atual={kpis.inativacoes} anterior={kpis.inativacoesAnt} subiuEhBom={false} /> : <span className="text-xs text-gray-500">disponível após a atualização do banco</span>)}
        </CartaoKpi>
        <CartaoKpi rotulo="Crescimento líquido" valor={loading ? '...' : `${kpis.crescimento > 0 ? '+' : ''}${kpis.crescimento}`} destaque={kpis.crescimento < 0 ? 'text-red-600' : kpis.crescimento > 0 ? 'text-green-700' : 'text-gray-900'}>
          {!loading && <span className="text-xs text-gray-500">novos − inativações</span>}
        </CartaoKpi>
      </div>

      {semAtivos && !erro && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">Nenhum aluno ativo neste recorte (unidade/modalidade).</div>
      )}

      <Secao titulo="Evolução financeira" subtitulo="Pelo mês do pagamento. Mostra no mínimo 6 meses para dar para ver a tendência.">
        <Grafico titulo="Receita recebida por mês" nota="Linha cinza: mesmo mês do período anterior" carregando={loading} vazio={!loading && financeira.every(l => l.recebida === 0 && l.anterior === 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={financeira}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="rotulo" />
              <YAxis tickFormatter={brlCurto} />
              <Tooltip formatter={tip} />
              <Legend />
              <Bar dataKey="recebida" name="Recebida" fill={COR.marca} radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="anterior" name="Período anterior" stroke={COR.anterior} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Receita prevista × recebida" nota="Prevista = recebida + a receber que vence no mês" carregando={loading} vazio={!loading && financeira.every(l => l.prevista === 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={financeira}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="rotulo" />
              <YAxis tickFormatter={brlCurto} />
              <Tooltip formatter={tip} />
              <Legend />
              <Bar dataKey="recebida" stackId="p" name="Recebida" fill={COR.recebido} />
              <Bar dataKey="aReceber" stackId="p" name="A receber" fill={COR.aReceber} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Lucro líquido por mês" nota={`No período: recebido ${brl(totaisPeriodo.bruto)} − despesas pagas ${brl(totaisPeriodo.despesas)} = ${brl(totaisPeriodo.lucro)}`} carregando={loading} vazio={!loading && lucro.every(l => l.bruto === 0 && l.despesas === 0)} largo>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={lucro}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="rotulo" />
              <YAxis tickFormatter={brlCurto} />
              <Tooltip formatter={tip} />
              <Legend />
              <Bar dataKey="despesas" name="Despesas pagas" fill={COR.vencido} radius={[6, 6, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro líquido" fill={COR.recebido} radius={[6, 6, 0, 0]}>
                {lucro.map(l => <Cell key={l.mes} fill={l.lucro < 0 ? COR.vencido : COR.recebido} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </Secao>

      <Secao titulo="Evolução dos alunos" subtitulo={rastreiaInativacao ? 'Base = alunos cadastrados menos as inativações com data registrada.' : 'As inativações ainda não têm data registrada: a base mostra todos os cadastros.'}>
        <Grafico titulo="Base de alunos" nota={inativosSemData > 0 ? `${inativosSemData} aluno(s) inativo(s) sem data de saída continuam contados na base` : undefined} carregando={loading} vazio={!loading && serieA.every(l => l.base === 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={serieA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="rotulo" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="base" name="Alunos na base" stroke={COR.base} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Novos alunos × inativações" carregando={loading} vazio={!loading && serieA.every(l => l.novos === 0 && l.inativacoes === 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serieA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="rotulo" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="novos" name="Novos" fill={COR.recebido} radius={[6, 6, 0, 0]} />
              <Bar dataKey="inativacoes" name="Inativações" fill={COR.vencido} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </Secao>

      <Secao titulo="Modalidades" subtitulo="Alunos ativos de hoje. O aluno em combo conta nas duas unidades.">
        <Grafico titulo="Participação de cada modalidade" nota="Um aluno com mais de uma modalidade entra em cada uma" carregando={loading} vazio={!loading && fatiasModalidade.length === 0}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={fatiasModalidade} dataKey="total" nameKey="modalidade" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {fatiasModalidade.map((f, i) => <Cell key={f.modalidade} fill={CORES_MODALIDADE[i % CORES_MODALIDADE.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full sm:w-1/2 space-y-2 text-sm">
              {fatiasModalidade.map((f, i) => (
                <li key={f.modalidade} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: CORES_MODALIDADE[i % CORES_MODALIDADE.length] }} />{f.modalidade}</span>
                  <span className="text-gray-700">{f.total} · {pct(f.pct)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Grafico>
        <Grafico titulo="Alunos por modalidade e esporte" carregando={loading} vazio={!loading && porModalidade.dados.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porModalidade.dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="modalidade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {porModalidade.esportes.map(e => <Bar key={e} dataKey={e} stackId="m" fill={corEsporte(e)} name={e} />)}
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Faturamento por professor (por esporte)" nota="Entradas recebidas no período, vinculadas ao professor" carregando={loading} vazio={!loading && porProfessor.dados.length === 0} altura={Math.max(220, porProfessor.dados.length * 44 + 70)} largo>
          <ResponsiveContainer width="100%" height={Math.max(220, porProfessor.dados.length * 44 + 70)}>
            <BarChart data={porProfessor.dados} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tickFormatter={brlCurto} />
              <YAxis type="category" dataKey="professor" width={90} />
              <Tooltip formatter={tip} />
              <Legend />
              {porProfessor.esportes.map(e => <Bar key={e} dataKey={e} stackId="p" fill={corEsporte(e)} name={e} />)}
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </Secao>

      <Secao titulo="Pagamentos" subtitulo="Pagos e cancelados são do período; a vencer e vencidos são a carteira em aberto de hoje.">
        <Grafico titulo="Situação dos pagamentos" carregando={loading} vazio={!loading && status.every(s => s.qtd === 0)}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={status.filter(s => s.qtd > 0)} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {status.filter(s => s.qtd > 0).map(s => (
                      <Cell key={s.nome} fill={s.nome === 'Pagos' ? COR.recebido : s.nome === 'A vencer' ? COR.aReceber : s.nome === 'Vencidos' ? COR.vencido : COR.cancelado} />
                    ))}
                  </Pie>
                  <Tooltip formatter={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full sm:w-1/2 space-y-2 text-sm">
              {status.map(s => (
                <li key={s.nome} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: s.nome === 'Pagos' ? COR.recebido : s.nome === 'A vencer' ? COR.aReceber : s.nome === 'Vencidos' ? COR.vencido : COR.cancelado }} />
                    {s.nome}
                  </span>
                  <span className="text-gray-700">{s.qtd} · {brl(s.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Grafico>
        <Grafico titulo="Faixas de atraso" nota="Dias desde o vencimento, só do que está vencido e em aberto" carregando={loading} vazio={!loading && faixas.every(f => f.qtd === 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={faixas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="faixa" />
              <YAxis tickFormatter={brlCurto} />
              <Tooltip formatter={(v, nome) => (nome === 'Valor em atraso' ? tip(v) : String(v))} />
              <Bar dataKey="valor" name="Valor em atraso" fill={COR.vencido} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {!loading && (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
              {faixas.map(f => <li key={f.faixa}>{f.faixa}: {f.qtd} cobrança{f.qtd === 1 ? '' : 's'}</li>)}
            </ul>
          )}
        </Grafico>
      </Secao>

      <section className="mb-8">
        <h2 className="text-section-title text-gray-900 mb-3">Frequência e utilização</h2>
        <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-gray-700">
          <Info size={18} className="shrink-0 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-950 mb-1">Ainda não dá para mostrar frequência, horários mais procurados nem ocupação de quadras.</p>
            <p>O sistema não registra presença, horários das aulas nem reservas de quadra. Para esses gráficos seria preciso cadastrar: turmas com dia, horário e capacidade; a presença de cada aluno por aula; e as reservas de quadra. Não mostro números inventados no lugar.</p>
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-500">
        Fórmulas: recebida = entradas com status Recebido pela data do pagamento; prevista = recebida + a receber que vence no período; inadimplência = alunos ativos com
        cobrança vencida em aberto ou vencimento do cadastro passado ÷ alunos ativos; crescimento = novos − inativações. Valores da unidade escolhida no menu.
      </p>
    </div>
  )
}
