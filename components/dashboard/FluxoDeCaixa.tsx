'use client'

import { useMemo, useState } from 'react'
import { Bar, Cell, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PontoFluxo } from '@/lib/fluxo-caixa'
import { fluxoDeCaixa, granularidadeAuto, previsaoDeCaixa, SEM_CONTA, type Granularidade, type MovFluxo } from '@/lib/fluxo-caixa'

const brl = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))

const COR = { entradas: '#16A34A', saidas: '#DC2626', saldo: '#2563EB' }
const NOME_GRAN: Record<Granularidade, string> = { dia: 'por dia', semana: 'por semana', mes: 'por mês' }
const UNIDADE_GRAN: Record<Granularidade, string> = { dia: 'dia', semana: 'semana', mes: 'mês' }
const ROTULO_BOTAO: Record<Granularidade, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês' }

function Kpi({ rotulo, valor, cor, nota }: { rotulo: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-medium text-gray-600">{rotulo}</div>
      <div className={`text-kpi-sm mt-0.5 ${cor ?? 'text-gray-900'}`}>{valor}</div>
      {nota && <div className="mt-1 text-xs text-gray-500 leading-4">{nota}</div>}
    </div>
  )
}

/** Fluxo de caixa realizado: o que entrou e saiu no período do Painel, com saldo de cada faixa. */
export default function FluxoDeCaixa({ movs, contas, inicio, fim, hoje, mensalidades, carregando }: {
  movs: MovFluxo[]
  contas: { id: string; nome: string }[]
  inicio: string
  fim: string
  hoje: string
  /** Soma das mensalidades dos alunos ativos da unidade (base da previsão) */
  mensalidades: number
  carregando?: boolean
}) {
  const [modo, setModo] = useState<'real' | 'previsao'>('real')
  const [conta, setConta] = useState('')
  // A escolha de Dia/Semana/Mês vale só para o período em que foi feita; ao trocar o período volta ao automático
  const [escolha, setEscolha] = useState<{ periodo: string; g: Granularidade } | null>(null)
  const periodoChave = `${inicio}|${fim}`
  const g: Granularidade = escolha && escolha.periodo === periodoChave ? escolha.g : granularidadeAuto(inicio, fim)

  const r = useMemo(() => fluxoDeCaixa(movs, { inicio, fim, granularidade: g, conta: conta || undefined }), [movs, inicio, fim, g, conta])
  const temMovimento = r.entradas > 0 || r.saidas > 0
  const semContaTotal = r.semConta.entradas + r.semConta.saidas
  const prev = useMemo(() => previsaoDeCaixa(movs, { hoje, mensalidades }), [movs, hoje, mensalidades])
  const emPrevisao = modo === 'previsao'
  const pontos: (PontoFluxo & { previsto?: boolean })[] = emPrevisao ? prev.pontos : r.pontos
  const rotuloGran = emPrevisao ? 'por mês' : NOME_GRAN[g]

  return (
    <div aria-label="Fluxo de caixa">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white" role="group" aria-label="O que mostrar">
          <button type="button" aria-pressed={!emPrevisao} onClick={() => setModo('real')}
            className={`h-9 px-3 text-sm whitespace-nowrap transition-colors ${!emPrevisao ? 'bg-gray-900 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>Realizado</button>
          <button type="button" aria-pressed={emPrevisao} onClick={() => setModo('previsao')}
            className={`h-9 px-3 text-sm whitespace-nowrap border-l border-gray-200 transition-colors ${emPrevisao ? 'bg-gray-900 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>Previsão (3 meses)</button>
        </div>
        {!emPrevisao && (
          <>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white" role="group" aria-label="Agrupar o gráfico">
              {(['dia', 'semana', 'mes'] as Granularidade[]).map((x, i) => (
                <button key={x} type="button" aria-pressed={g === x} onClick={() => setEscolha({ periodo: periodoChave, g: x })}
                  className={`h-9 px-3 text-sm whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${g === x ? 'bg-gray-900 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{ROTULO_BOTAO[x]}</button>
              ))}
            </div>
            <select value={conta} onChange={e => setConta(e.target.value)} aria-label="Filtrar por conta"
              className="h-9 border border-gray-200 rounded-lg px-3 text-sm bg-white">
              <option value="">Todas as contas</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value={SEM_CONTA}>Sem conta informada</option>
            </select>
          </>
        )}
      </div>

      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {emPrevisao ? (
          <>
            <Kpi rotulo="Entradas previstas" valor={brl(prev.entradasPrevistas)} cor="text-green-700" nota="próximos 3 meses" />
            <Kpi rotulo="Saídas previstas" valor={brl(prev.saidasPrevistas)} cor="text-red-600" nota={`média de ${brl(prev.mediaSaidas)} por mês`} />
            <Kpi rotulo="Saldo previsto" valor={brl(prev.saldoPrevisto)} cor={prev.saldoPrevisto >= 0 ? 'text-blue-600' : 'text-red-600'} nota="entradas menos saídas" />
            <Kpi rotulo="Mês mais apertado" valor={prev.menorSaldoPrevisto ? brl(prev.menorSaldoPrevisto.saldo) : '—'} cor={prev.menorSaldoPrevisto && prev.menorSaldoPrevisto.saldo < 0 ? 'text-red-600' : undefined} nota={prev.menorSaldoPrevisto ? prev.menorSaldoPrevisto.rotulo : undefined} />
          </>
        ) : (
          <>
            <Kpi rotulo="Entradas" valor={brl(r.entradas)} cor="text-green-700" />
            <Kpi rotulo="Saídas" valor={brl(r.saidas)} cor="text-red-600" />
            <Kpi rotulo="Saldo do período" valor={brl(r.saldo)} cor={r.saldo >= 0 ? 'text-blue-600' : 'text-red-600'} nota="entradas menos saídas" />
            <Kpi rotulo={`Maior saída em um ${UNIDADE_GRAN[g]}`} valor={r.maiorSaida ? brl(r.maiorSaida.saidas) : '—'} nota={r.maiorSaida ? r.maiorSaida.rotulo : 'sem saídas no período'} />
          </>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-900">Entradas, saídas e saldo {rotuloGran}{emPrevisao ? ' · barras claras = previsão' : ''}</div>
        <div className="mt-3" style={{ minHeight: 280 }}>
          {carregando ? (
            <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: 280 }}>Carregando...</div>
          ) : !emPrevisao && !temMovimento ? (
            <div className="flex items-center justify-center text-center text-sm text-gray-400 px-4" style={{ height: 280 }}>Nenhuma entrada ou saída paga neste período{conta ? ' nesta conta' : ''}.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
                <YAxis width={56} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={brlCurto} />
                <Tooltip formatter={(v: unknown) => brl(Number(v ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <ReferenceLine y={0} stroke="#9CA3AF" />
                <Bar dataKey="entradas" name="Entradas" fill={COR.entradas} radius={[3, 3, 0, 0]} maxBarSize={22}>
                  {pontos.map(p => <Cell key={p.chave} fill={COR.entradas} fillOpacity={p.previsto ? 0.4 : 1} />)}
                </Bar>
                <Bar dataKey="saidas" name="Saídas" fill={COR.saidas} radius={[3, 3, 0, 0]} maxBarSize={22}>
                  {pontos.map(p => <Cell key={p.chave} fill={COR.saidas} fillOpacity={p.previsto ? 0.4 : 1} />)}
                </Bar>
                <Line type="linear" dataKey="saldo" name="Saldo" stroke={COR.saldo} strokeWidth={2} dot={pontos.length <= 40} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        {!emPrevisao && semContaTotal > 0 && !conta && (
          <p className="mt-2 text-xs text-amber-700">{r.semConta.qtd} lançamento(s) sem conta informada ({brl(r.semConta.entradas)} de entradas e {brl(r.semConta.saidas)} de saídas). Use o filtro “Sem conta informada” para ver quais são.</p>
        )}
      </div>

      <details className="mt-3 bg-white border border-gray-200 rounded-xl">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700">Ver {rotuloGran} em tabela</summary>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full text-sm whitespace-nowrap border-separate border-spacing-0">
            <thead className="[&>tr>th]:border-b [&>tr>th]:border-gray-200">
              <tr className="text-left text-gray-600">
                <th className="py-2 pr-4 font-medium">{emPrevisao ? 'Mês' : ROTULO_BOTAO[g]}</th>
                <th className="py-2 px-4 font-medium text-right">Entradas</th>
                <th className="py-2 px-4 font-medium text-right">Saídas</th>
                <th className="py-2 px-4 font-medium text-right">Saldo</th>
                <th className="py-2 pl-4 font-medium text-right" title="Soma dos saldos desde o começo do período">Acumulado</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-gray-100 tabular-nums">
              {pontos.map(p => (
                <tr key={p.chave} className="text-gray-800">
                  <td className="py-2 pr-4">{p.rotulo}{p.previsto ? ' (previsão)' : ''}</td>
                  <td className="py-2 px-4 text-right text-green-700">{brl(p.entradas)}</td>
                  <td className="py-2 px-4 text-right text-red-600">{brl(p.saidas)}</td>
                  <td className={`py-2 px-4 text-right font-medium ${p.saldo < 0 ? 'text-red-600' : ''}`}>{brl(p.saldo)}</td>
                  <td className={`py-2 pl-4 text-right ${p.acumulado < 0 ? 'text-red-600' : ''}`}>{brl(p.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            {emPrevisao
              ? 'Previsão por mês, a partir do mês que vem: entradas = o maior entre as mensalidades dos alunos ativos e o que já está lançado a receber no mês; saídas = o maior entre a média das saídas pagas nos 3 meses anteriores e o que já está lançado a pagar no mês. Usa o maior (e não a soma) para não contar duas vezes algo já lançado. Atrasos antigos não entram, porque não dá para saber se serão pagos; trancamentos e novas matrículas futuras também não são previstos.'
              : 'Só conta o que já foi recebido ou pago; o que está em aberto ainda não entra (veja a aba Previsão).'}
            “Acumulado” soma os saldos desde o começo do período: não é o saldo do banco, porque o sistema ainda não sabe quanto havia em cada conta no início.
          </p>
        </div>
      </details>
    </div>
  )
}
