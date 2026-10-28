'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, ChevronRight, Download, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { BotaoImprimir, CabecalhoImpressao } from '@/components/relatorios/CabecalhoImpressao'
import { mesesDaJanela, periodoDe, rotuloMes, type Preset } from '@/lib/painel'
import {
  comissaoPorProfessor, competenciaDe, faturamentoPorEsporte, paraCsv,
  type AlunoR, type EntradaRecebida, type MatriculaR, type MovEsporte, type ProfessorR,
} from '@/lib/relatorios-gerenciais'

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))
const tip = (v: unknown) => brl(Number(v ?? 0))

const COR_SITUACAO: Record<string, string> = {
  Pago: 'bg-green-50 text-green-700',
  Inadimplente: 'bg-red-50 text-red-700',
  'A vencer': 'bg-amber-50 text-amber-700',
}
const PRESETS: { id: Preset; nome: string }[] = [
  { id: 'mes_atual', nome: 'Mês atual' },
  { id: 'mes_anterior', nome: 'Mês anterior' },
  { id: '3m', nome: '3 meses' },
  { id: '6m', nome: '6 meses' },
  { id: 'custom', nome: 'Personalizado' },
]

function baixar(nome: string, linhas: (string | number)[][]) {
  const blob = new Blob([paraCsv(linhas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

const selectCls = 'h-9 border border-gray-200 rounded-lg px-2 text-sm bg-white'
const th = 'px-3 py-2.5 text-th text-gray-500'

type LinhaAluno = AlunoR & { unidade_id: string | null }
type LinhaMat = Omit<MatriculaR, 'esporte_nome'> & { esportes: { nome: string } | null }
type LinhaMov = {
  tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null
  data_vencimento: string | null; aluno_ref_id: string | null; esportes: { nome: string } | null
}

export default function Relatorios() {
  const { unidadeId, unidade } = useUnidade()
  const hoje = useMemo(() => new Date().toLocaleDateString('en-CA'), [])

  const [aba, setAba] = useState<'comissao' | 'esporte'>('comissao')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [professores, setProfessores] = useState<ProfessorR[]>([])
  const [alunos, setAlunos] = useState<LinhaAluno[]>([])
  const [mats, setMats] = useState<LinhaMat[]>([])
  const [movs, setMovs] = useState<LinhaMov[]>([])

  // filtros: comissão
  const mesAtual = hoje.slice(0, 7)
  const [mes, setMes] = useState(mesAtual)
  const [filtroProfessor, setFiltroProfessor] = useState('')
  const [filtroEsporte, setFiltroEsporte] = useState('')
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [imprimindo, setImprimindo] = useState(false)
  useEffect(() => {
    const antes = () => setImprimindo(true)
    const depois = () => setImprimindo(false)
    window.addEventListener('beforeprint', antes)
    window.addEventListener('afterprint', depois)
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois) }
  }, [])
  // filtros: esporte
  const [preset, setPreset] = useState<Preset>('mes_atual')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [ratear, setRatear] = useState(false)

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setLoading(true)
      setErro(null)
      const corte = `${new Date().getFullYear() - 2}-01-01`
      let ra = await buscarTudo((de, ate) => supabase.from('alunos').select('id, nome, status, data_cadastro, data_inativacao, data_vencimento, unidade_id').order('id').range(de, ate))
      if (ra.error) ra = await buscarTudo((de, ate) => supabase.from('alunos').select('id, nome, status, data_cadastro, data_vencimento, unidade_id').order('id').range(de, ate)) as typeof ra
      const [rp, rm, rf] = await Promise.all([
        supabase.from('professores').select('id, nome, comissao_percentual').order('nome'),
        buscarTudo((de, ate) => supabase.from('matriculas').select('aluno_id, tipo, valor, professor_id, professor_nome, unidade_id, acesso_duas_unidades, esportes(nome)').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase
          .from('movimentacoes')
          .select('tipo, status, valor, data, data_pagamento, data_vencimento, aluno_ref_id, esportes(nome)')
          .eq('unidade_id', unidadeId)
          .or(`data.gte.${corte},data_pagamento.gte.${corte}`)
          .order('id').range(de, ate)),
      ])
      if (cancelado) return
      if (ra.error || rp.error || rm.error || rf.error) {
        setErro('Não consegui carregar os dados dos relatórios. Atualize a página; se continuar, avise o suporte.')
        setLoading(false)
        return
      }
      setAlunos(((ra.data ?? []) as unknown as LinhaAluno[]).map(a => ({ ...a, data_inativacao: a.data_inativacao ?? null })))
      setProfessores((rp.data ?? []) as ProfessorR[])
      setMats((rm.data ?? []) as unknown as LinhaMat[])
      setMovs((rf.data ?? []) as unknown as LinhaMov[])
      setLoading(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId])

  /* ---------- comissão ---------- */
  const mesesOpcoes = useMemo(() => mesesDaJanela(`${hoje.slice(0, 4)}-01-01`, hoje, 12).reverse(), [hoje])
  const matsR: MatriculaR[] = useMemo(() => mats.map(m => ({ ...m, esporte_nome: m.esportes?.nome ?? null })), [mats])
  const entradas: EntradaRecebida[] = useMemo(() => movs
    .filter(m => m.tipo === 'Entrada' && m.status === 'Recebido')
    .map(m => ({ aluno_ref_id: m.aluno_ref_id, valor: Number(m.valor), competencia: competenciaDe(m) })), [movs])
  const esportesOpcoes = useMemo(() => Array.from(new Set(matsR.map(m => m.esporte_nome ?? 'Sem esporte'))).sort(), [matsR])
  const professoresComAula = useMemo(() => {
    const nomes = new Set(matsR.filter(m => m.professor_nome || m.professor_id).map(m => (m.professor_nome ?? '').trim().toLowerCase()))
    return professores.filter(p => nomes.has(p.nome.trim().toLowerCase()) || matsR.some(m => m.professor_id === p.id))
  }, [professores, matsR])

  const comissao = useMemo(() => comissaoPorProfessor({
    mes, hoje, professores, alunos, matriculas: matsR, entradas, unidadeId,
    filtroProfessorId: filtroProfessor || null, filtroEsporte: filtroEsporte || null,
  }), [mes, hoje, professores, alunos, matsR, entradas, unidadeId, filtroProfessor, filtroEsporte])

  function exportarComissao() {
    const linhas: (string | number)[][] = [
      ['Professor', '% comissão', 'Aluno', 'Esporte', 'Mensalidade com o professor', 'Situação', 'Comissão', 'Descontado (inadimplência)', 'Valor devido'],
    ]
    for (const l of comissao.linhas) for (const d of l.detalhe) {
      linhas.push([l.professor, l.percentual ?? '', d.nome, d.esporte, d.valorProfessor, d.situacao, d.comissao, d.descontado, d.devido])
    }
    linhas.push([], ['TOTAL', '', '', '', comissao.totais.base, '', comissao.totais.comissaoTotal, comissao.totais.descontado, comissao.totais.devido])
    baixar(`comissao-professores-${mes}.csv`, linhas)
  }

  /* ---------- faturamento por esporte ---------- */
  const periodo = useMemo(() => periodoDe(preset, hoje, de, ate), [preset, hoje, de, ate])
  const movsEsporte: MovEsporte[] = useMemo(() => movs.map(m => ({
    tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento, esporte_nome: m.esportes?.nome ?? null,
  })), [movs])
  const porEsporte = useMemo(() => faturamentoPorEsporte({ movs: movsEsporte, inicio: periodo.inicio, fim: periodo.fim, ratear }), [movsEsporte, periodo, ratear])

  function exportarEsporte() {
    const linhas: (string | number)[][] = [['Esporte', 'Faturamento', 'Despesas do esporte', 'Resultado', ...(ratear ? ['Despesas gerais rateadas', 'Lucro líquido'] : [])]]
    for (const l of porEsporte.linhas) linhas.push([l.esporte, l.faturamento, l.despesas, l.resultado, ...(ratear ? [l.rateio, l.lucro] : [])])
    linhas.push([], ['Despesas gerais (sem esporte)', '', porEsporte.despesasGerais], ['TOTAL', porEsporte.totais.faturamento, porEsporte.totais.despesas, '', '', porEsporte.totais.lucro])
    baixar(`faturamento-por-esporte-${periodo.inicio}-a-${periodo.fim}.csv`, linhas)
  }

  const nomeMes = (m: string) => `${rotuloMes(m)}`

  return (
    <div className="max-w-6xl">
      <div className="mb-5 pl-12 md:pl-0 print:hidden">
        <h1 className="text-page-title text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500">{unidade?.nome ?? ''}</p>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden mb-5 print:hidden">
        {([['comissao', 'Comissão dos professores'], ['esporte', 'Faturamento e lucro por esporte']] as const).map(([id, nome]) => (
          <button key={id} type="button" onClick={() => setAba(id)}
            className={`px-4 h-10 text-sm font-medium transition-colors ${aba === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {nome}
          </button>
        ))}
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {aba === 'comissao' && (
        <section>
          <CabecalhoImpressao titulo="Comissão dos professores" unidade={unidade?.nome} linhas={[`Competência: ${nomeMes(mes)}`, ...(filtroProfessor ? [`Professor: ${professores.find(p => p.id === filtroProfessor)?.nome ?? ''}`] : []), ...(filtroEsporte ? [`Esporte: ${filtroEsporte}`] : [])]} />
          <div className="flex flex-wrap items-end gap-3 mb-4 print:hidden">
            <label className="text-sm text-gray-700">Mês de competência
              <select value={mes} onChange={e => setMes(e.target.value)} className={`${selectCls} block mt-1`}>
                {mesesOpcoes.map(m => <option key={m} value={m}>{nomeMes(m)}{m === mesAtual ? ' (atual)' : ''}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-700">Professor
              <select value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)} className={`${selectCls} block mt-1`}>
                <option value="">Todos</option>
                {professoresComAula.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-700">Esporte
              <select value={filtroEsporte} onChange={e => setFiltroEsporte(e.target.value)} className={`${selectCls} block mt-1`}>
                <option value="">Todos</option>
                {esportesOpcoes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
            <button type="button" onClick={exportarComissao} disabled={comissao.linhas.length === 0}
              className="ml-auto inline-flex items-center gap-2 h-9 px-3 text-sm border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
              <Download size={15} /> Exportar planilha
            </button>
            <BotaoImprimir desabilitado={comissao.linhas.length === 0} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-600">Comissão total</div>
              <div className="text-kpi text-gray-900">{loading ? '...' : brl(comissao.totais.comissaoTotal)}</div>
              <div className="text-xs text-gray-500">sobre {brl(comissao.totais.base)} de mensalidades</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-600">Descontado (inadimplentes)</div>
              <div className={`text-kpi ${comissao.totais.descontado > 0 ? 'text-red-600' : 'text-gray-900'}`}>{loading ? '...' : brl(comissao.totais.descontado)}</div>
              <div className="text-xs text-gray-500">parte da comissão ligada ao que não foi pago</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-600">Valor devido</div>
              <div className="text-kpi text-green-700">{loading ? '...' : brl(comissao.totais.devido)}</div>
              <div className="text-xs text-gray-500">comissão total − descontado</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className={th}>Professor</th>
                  <th className={`${th} text-right`}>%</th>
                  <th className={`${th} text-right`}>Alunos</th>
                  <th className={`${th} text-right`}>Mensalidades</th>
                  <th className={`${th} text-right`}>Comissão total</th>
                  <th className={`${th} text-right`}>Descontado</th>
                  <th className={`${th} text-right`}>Valor devido</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
                {!loading && comissao.linhas.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhum aluno com professor nesta competência e filtros.</td></tr>
                )}
                {comissao.linhas.map(l => {
                  const aberto = !!abertos[l.professor] || imprimindo
                  return (
                    <Fragment key={l.professor}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setAbertos(a => ({ ...a, [l.professor]: !aberto }))}>
                        <td className="px-3 py-3 font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            {l.professor}
                          </span>
                          {l.semPercentual && <span className="ml-2 text-xs font-normal text-amber-700">defina a comissão em Cadastros &gt; Professores</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{l.percentual === null ? '—' : `${l.percentual.toLocaleString('pt-BR')}%`}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{l.alunos}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{brl(l.base)}</td>
                        <td className="px-3 py-3 text-right text-gray-900">{brl(l.comissaoTotal)}</td>
                        <td className={`px-3 py-3 text-right ${l.descontado > 0 ? 'text-red-600' : 'text-gray-500'}`}>{l.descontado > 0 ? `− ${brl(l.descontado)}` : brl(0)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-green-700">{brl(l.devido)}</td>
                      </tr>
                      {aberto && l.detalhe.map(d => (
                        <tr key={`${l.professor}-${d.alunoId}-${d.esporte}-${d.valorProfessor}`} className="bg-gray-50/70 border-b border-gray-100 text-xs">
                          <td className="pl-10 pr-3 py-2 text-gray-800">{d.nome} <span className="text-gray-400">· {d.esporte}</span></td>
                          <td className="px-3 py-2 text-right"><span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${COR_SITUACAO[d.situacao]}`}>{d.situacao}</span></td>
                          <td className="px-3 py-2 text-right text-gray-500" title="Recebido na competência / total do aluno">{brl(d.recebido)} / {brl(d.totalAluno)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{brl(d.valorProfessor)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{brl(d.comissao)}</td>
                          <td className={`px-3 py-2 text-right ${d.descontado > 0 ? 'text-red-600' : 'text-gray-400'}`}>{d.descontado > 0 ? `− ${brl(d.descontado)}` : brl(0)}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{brl(d.devido)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
              {comissao.linhas.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-900">
                    <td className="px-3 py-3" colSpan={3}>Total</td>
                    <td className="px-3 py-3 text-right">{brl(comissao.totais.base)}</td>
                    <td className="px-3 py-3 text-right">{brl(comissao.totais.comissaoTotal)}</td>
                    <td className="px-3 py-3 text-right text-red-600">{comissao.totais.descontado > 0 ? `− ${brl(comissao.totais.descontado)}` : brl(0)}</td>
                    <td className="px-3 py-3 text-right text-green-700">{brl(comissao.totais.devido)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-3 flex gap-2 text-xs text-gray-500">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>
              Competência = mês do vencimento da mensalidade. Comissão = mensalidade do aluno com o professor × % do professor (clique no professor para ver aluno a aluno).
              Aluno é <strong>inadimplente</strong> quando o vencimento do mês já passou e ele ainda não pagou tudo que deve na unidade; o desconto é a parte da comissão ligada ao que falta.
              Quem ainda não venceu não é descontado. A conta usa as matrículas de hoje; mudanças de professor ou de valor em meses passados não ficam guardadas.
            </p>
          </div>
        </section>
      )}

      {aba === 'esporte' && (
        <section>
          <CabecalhoImpressao titulo="Faturamento e lucro por esporte" unidade={unidade?.nome} linhas={[`Período: ${periodo.inicio.split('-').reverse().join('/')} a ${periodo.fim.split('-').reverse().join('/')}`, ratear ? 'Despesas gerais rateadas entre os esportes' : 'Despesas gerais sem rateio']} />
          <div className="flex flex-wrap items-end gap-3 mb-4 print:hidden">
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
                <input type="date" value={de} max={hoje} onChange={e => setDe(e.target.value)} className={selectCls} aria-label="De" />
                até
                <input type="date" value={ate} max={hoje} onChange={e => setAte(e.target.value)} className={selectCls} aria-label="Até" />
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={ratear} onChange={e => setRatear(e.target.checked)} />
              Ratear despesas gerais entre os esportes
            </label>
            <button type="button" onClick={exportarEsporte} disabled={porEsporte.linhas.length === 0}
              className="ml-auto inline-flex items-center gap-2 h-9 px-3 text-sm border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
              <Download size={15} /> Exportar planilha
            </button>
            <BotaoImprimir desabilitado={porEsporte.linhas.length === 0} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-600">Faturamento</div>
              <div className="text-kpi text-gray-900">{loading ? '...' : brl(porEsporte.totais.faturamento)}</div>
              <div className="text-xs text-gray-500">entradas recebidas no período</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-600">Despesas pagas</div>
              <div className="text-kpi text-red-600">{loading ? '...' : brl(porEsporte.totais.despesas)}</div>
              <div className="text-xs text-gray-500">{brl(porEsporte.despesasGerais)} são gerais (sem esporte)</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-600">Lucro líquido</div>
              <div className={`text-kpi ${porEsporte.totais.lucro < 0 ? 'text-red-600' : 'text-green-700'}`}>{loading ? '...' : brl(porEsporte.totais.lucro)}</div>
              <div className="text-xs text-gray-500">faturamento − despesas</div>
            </div>
          </div>

          {porEsporte.linhas.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">{ratear ? 'Faturamento e lucro (com rateio) por esporte' : 'Faturamento e resultado por esporte'}</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porEsporte.linhas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="esporte" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis width={52} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={brlCurto} />
                  <Tooltip formatter={tip} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                  <Bar dataKey="faturamento" name="Faturamento" fill="#7DC421" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={ratear ? 'lucro' : 'resultado'} name={ratear ? 'Lucro líquido' : 'Resultado (sem despesas gerais)'} fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className={th}>Esporte</th>
                  <th className={`${th} text-right`}>Faturamento</th>
                  <th className={`${th} text-right`}>Despesas do esporte</th>
                  <th className={`${th} text-right`}>Resultado</th>
                  {ratear && <th className={`${th} text-right`}>Despesas gerais rateadas</th>}
                  {ratear && <th className={`${th} text-right`}>Lucro líquido</th>}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={ratear ? 6 : 4} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
                {!loading && porEsporte.linhas.length === 0 && <tr><td colSpan={ratear ? 6 : 4} className="text-center py-8 text-gray-400">Sem lançamentos neste período.</td></tr>}
                {porEsporte.linhas.map(l => (
                  <tr key={l.esporte} className="border-b border-gray-100">
                    <td className="px-3 py-3 font-medium text-gray-900">{l.esporte}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{brl(l.faturamento)}</td>
                    <td className="px-3 py-3 text-right text-red-600">{l.despesas > 0 ? `− ${brl(l.despesas)}` : brl(0)}</td>
                    <td className={`px-3 py-3 text-right ${l.resultado < 0 ? 'text-red-600' : 'text-gray-900'}`}>{brl(l.resultado)}</td>
                    {ratear && <td className="px-3 py-3 text-right text-red-600">{l.rateio > 0 ? `− ${brl(l.rateio)}` : brl(0)}</td>}
                    {ratear && <td className={`px-3 py-3 text-right font-semibold ${l.lucro < 0 ? 'text-red-600' : 'text-green-700'}`}>{brl(l.lucro)}</td>}
                  </tr>
                ))}
                {!ratear && porEsporte.despesasGerais > 0 && (
                  <tr className="border-b border-gray-100 text-gray-600">
                    <td className="px-3 py-3">Despesas gerais (sem esporte)</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right text-red-600">− {brl(porEsporte.despesasGerais)}</td>
                    <td className="px-3 py-3 text-right text-red-600">− {brl(porEsporte.despesasGerais)}</td>
                  </tr>
                )}
              </tbody>
              {porEsporte.linhas.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-900">
                    <td className="px-3 py-3">Total</td>
                    <td className="px-3 py-3 text-right">{brl(porEsporte.totais.faturamento)}</td>
                    <td className="px-3 py-3 text-right text-red-600">− {brl(porEsporte.totais.despesas)}</td>
                    <td className={`px-3 py-3 text-right ${porEsporte.totais.lucro < 0 ? 'text-red-600' : 'text-green-700'}`}>{brl(porEsporte.totais.lucro)}</td>
                    {ratear && <td className="px-3 py-3" />}
                    {ratear && <td className={`px-3 py-3 text-right ${porEsporte.totais.lucro < 0 ? 'text-red-600' : 'text-green-700'}`}>{brl(porEsporte.totais.lucro)}</td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-3 flex gap-2 text-xs text-gray-500">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>
              Faturamento = entradas recebidas no período (pela data do pagamento). Despesas = saídas pagas. O esporte vem do lançamento: pagamentos lançados pelo sistema
              guardam o esporte de cada matrícula; entradas sem esporte aparecem em &quot;Sem esporte&quot; e despesas sem esporte são &quot;gerais&quot;. Para atribuir uma despesa a um esporte, use o campo
              Esporte em Financeiro. Com o rateio ligado, as despesas gerais são divididas em proporção ao faturamento; o lucro líquido total não muda.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
