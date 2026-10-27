'use client'

import { useMemo, useState } from 'react'
import { Bar, Cell, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { previsaoDeCaixa, type MovFluxo } from '@/lib/fluxo-caixa'

const brl = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))

const COR = { entradas: '#16A34A', saidas: '#DC2626', saldo: '#2563EB' }
const PASSADO = [3, 6, 12]
const FUTURO = [3, 6]

function Kpi({ rotulo, valor, cor, nota }: { rotulo: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-medium text-gray-600">{rotulo}</div>
      <div className={`text-kpi-sm mt-0.5 ${cor ?? 'text-gray-900'}`}>{valor}</div>
      {nota && <div className="mt-1 text-xs text-gray-500 leading-4">{nota}</div>}
    </div>
  )
}

function Escolha({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: number[]; valor: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span>{rotulo}</span>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white" role="group" aria-label={rotulo}>
        {opcoes.map((n, i) => (
          <button key={n} type="button" aria-pressed={valor === n} onClick={() => onChange(n)}
            className={`h-9 px-3 text-sm whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${valor === n ? 'bg-gray-900 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{n} meses</button>
        ))}
      </div>
    </div>
  )
}

/** Fluxo de caixa mensal: meses passados (realizado) e meses à frente (previsão), no mesmo gráfico. */
export default function FluxoDeCaixa({ movs, hoje, mensalidades, carregando }: {
  movs: MovFluxo[]
  hoje: string
  /** Soma das mensalidades dos alunos ativos da unidade (base da previsão) */
  mensalidades: number
  carregando?: boolean
}) {
  const [passados, setPassados] = useState(6)
  const [futuros, setFuturos] = useState(3)
  const r = useMemo(() => previsaoDeCaixa(movs, { hoje, mensalidades, meses: futuros, mesesPassados: passados }), [movs, hoje, mensalidades, futuros, passados])
  const pontos = r.pontos
  const saldoRealizado = pontos.filter(p => !p.previsto).reduce((a, p) => a + p.saldo, 0)
  const temMovimento = pontos.some(p => p.entradas > 0 || p.saidas > 0)

  return (
    <div aria-label="Fluxo de caixa">
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Escolha rotulo="Para trás" opcoes={PASSADO} valor={passados} onChange={setPassados} />
        <Escolha rotulo="Para frente" opcoes={FUTURO} valor={futuros} onChange={setFuturos} />
      </div>

      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Kpi rotulo="Já realizado" valor={brl(saldoRealizado)} cor={saldoRealizado >= 0 ? 'text-blue-600' : 'text-red-600'} nota={`saldo dos últimos ${passados} meses fechados`} />
        <Kpi rotulo="Entradas previstas" valor={brl(r.entradasPrevistas)} cor="text-green-700" nota="mês atual e meses à frente" />
        <Kpi rotulo="Saídas previstas" valor={brl(r.saidasPrevistas)} cor="text-red-600" nota={`média de ${brl(r.mediaSaidas)} por mês`} />
        <Kpi rotulo="Mês mais apertado" valor={r.menorSaldoPrevisto ? brl(r.menorSaldoPrevisto.saldo) : '—'} cor={r.menorSaldoPrevisto && r.menorSaldoPrevisto.saldo < 0 ? 'text-red-600' : undefined}
          nota={r.menorSaldoPrevisto ? `${r.menorSaldoPrevisto.rotulo} · saldo previsto no total: ${brl(r.saldoPrevisto)}` : undefined} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-900">Entradas, saídas e saldo por mês · barras claras = previsão</div>
        <div className="mt-3" style={{ minHeight: 280 }}>
          {carregando ? (
            <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: 280 }}>Carregando...</div>
          ) : !temMovimento ? (
            <div className="flex items-center justify-center text-center text-sm text-gray-400 px-4" style={{ height: 280 }}>Nenhuma entrada ou saída neste período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
                <YAxis width={56} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={brlCurto} />
                <Tooltip formatter={(v: unknown) => brl(Number(v ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <ReferenceLine y={0} stroke="#9CA3AF" />
                <Bar dataKey="entradas" name="Entradas" fill={COR.entradas} radius={[3, 3, 0, 0]} maxBarSize={26}>
                  {pontos.map(p => <Cell key={p.chave} fill={COR.entradas} fillOpacity={p.previsto ? 0.4 : 1} />)}
                </Bar>
                <Bar dataKey="saidas" name="Saídas" fill={COR.saidas} radius={[3, 3, 0, 0]} maxBarSize={26}>
                  {pontos.map(p => <Cell key={p.chave} fill={COR.saidas} fillOpacity={p.previsto ? 0.4 : 1} />)}
                </Bar>
                <Line type="linear" dataKey="saldo" name="Saldo" stroke={COR.saldo} strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <details className="mt-3 bg-white border border-gray-200 rounded-xl">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700">Ver por mês em tabela</summary>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full text-sm whitespace-nowrap border-separate border-spacing-0">
            <thead className="[&>tr>th]:border-b [&>tr>th]:border-gray-200">
              <tr className="text-left text-gray-600">
                <th className="py-2 pr-4 font-medium">Mês</th>
                <th className="py-2 px-4 font-medium text-right">Entradas</th>
                <th className="py-2 px-4 font-medium text-right">Saídas</th>
                <th className="py-2 px-4 font-medium text-right">Saldo</th>
                <th className="py-2 pl-4 font-medium text-right" title="Soma dos saldos desde o primeiro mês mostrado">Acumulado</th>
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
            Meses passados: só o que já foi recebido ou pago, pelo dia do pagamento. Mês atual e à frente (barras claras): entradas = o maior entre as mensalidades dos alunos ativos e o que já está lançado a receber;
            saídas = o maior entre a média das saídas pagas nos 3 meses anteriores e o que já está lançado a pagar. No mês atual soma-se o que já entrou e saiu até hoje.
            Usa o maior (e não a soma) para não contar duas vezes algo já lançado. Atrasos antigos, matrículas novas e cancelamentos futuros não são previstos.
            “Acumulado” não é o saldo do banco: o sistema ainda não sabe quanto havia em cada conta no início.
          </p>
        </div>
      </details>
    </div>
  )
}
