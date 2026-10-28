'use client'

// Gráficos dos temas do Painel. Ficam num arquivo à parte, carregado só quando um tema abre:
// assim a biblioteca de gráficos não pesa na entrada do Painel.

import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { EstadoPeriodo } from '@/components/dashboard/FiltroPeriodo'
import type { FaixaAtraso, FatiaStatus, LinhaAlunos, LinhaFinanceira } from '@/lib/painel'
import type { DespesaCat, PontoMensal, faturamentoProfessores } from '@/lib/painel-graficos'
import type { LinhaMes, LinhaModalidade, alunosPorModalidade } from '@/lib/relatorios'
import {
  ALTURA, COR, COR_STATUS, Grade, Grafico, MARGEM, PALETA_CATEGORIAS, brl, brlCurto, corEsporte, eixoX, eixoY, legenda, pct, tip,
} from '@/components/dashboard/painel-ui'
import { rotuloDoPeriodo } from '@/components/dashboard/FiltroPeriodo'

export function GraficosFinanceiro({ financeira, temAnterior, lucro, totaisPeriodo, modalidade, despesasCat, despesasOcultas, totalDespesasCat, alternarCategoria, pFin, loadingDet }: {
  financeira: LinhaFinanceira[]
  temAnterior: boolean
  lucro: LinhaMes[]
  totaisPeriodo: { bruto: number; despesas: number; lucro: number }
  modalidade: string
  despesasCat: DespesaCat[]
  despesasOcultas: DespesaCat[]
  totalDespesasCat: number
  alternarCategoria: (nome: string) => void
  pFin: EstadoPeriodo
  loadingDet: boolean
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Grafico titulo="Receita recebida por mês" nota={temAnterior ? 'Linha cinza: mesmo mês do período anterior' : undefined}
        carregando={loadingDet} vazio={!loadingDet && financeira.every(l => l.recebida === 0 && l.anterior === 0)} mensagemVazio="Nenhuma receita recebida neste período">
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
        carregando={loadingDet} vazio={!loadingDet && financeira.every(l => l.prevista === 0)} mensagemVazio="Nada recebido nem a receber neste período">
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
        carregando={loadingDet} vazio={!loadingDet && lucro.every(l => l.bruto === 0 && l.despesas === 0)} mensagemVazio="Sem receitas nem despesas pagas neste período">
        <ResponsiveContainer width="100%" height={ALTURA}>
          <BarChart data={lucro} margin={MARGEM}>
            <Grade />
            <XAxis dataKey="rotulo" {...eixoX} />
            <YAxis {...eixoY} tickFormatter={brlCurto} />
            <Tooltip formatter={tip} />
            <Bar dataKey="lucro" name="Lucro líquido" fill={COR.recebido} radius={[4, 4, 0, 0]}>
              {lucro.map(l => <Cell key={l.mes} fill={l.lucro < 0 ? COR.vencido : COR.recebido} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Grafico>
      <Grafico titulo="Despesas por categoria" nota={`Despesas pagas de ${rotuloDoPeriodo(pFin.periodo.inicio, pFin.periodo.fim)}: ${brl(totalDespesasCat)}. Clique numa categoria para tirá-la do cálculo.`}
        carregando={loadingDet} vazio={!loadingDet && despesasCat.length === 0 && despesasOcultas.length === 0} mensagemVazio="Nenhuma despesa paga neste período">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height={ALTURA}>
              <PieChart>
                <Pie data={despesasCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2} onClick={(d: { name?: string }) => d.name && alternarCategoria(d.name)} style={{ cursor: 'pointer' }}>
                  {despesasCat.map((d, i) => <Cell key={d.name} fill={d.name === 'Outras' ? COR.cancelado : PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length]} />)}
                </Pie>
                <Tooltip formatter={tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full sm:w-1/2 space-y-1.5 text-sm">
            {despesasCat.map((d, i) => (
              <li key={d.name}>
                <button type="button" disabled={d.name === 'Outras'} onClick={() => alternarCategoria(d.name)} title={d.name === 'Outras' ? undefined : 'Tirar do cálculo'}
                  className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left enabled:hover:bg-gray-50">
                  <span className="inline-flex items-center gap-2 min-w-0"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.name === 'Outras' ? COR.cancelado : PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length] }} /><span className="truncate">{d.name}</span></span>
                  <span className="shrink-0 text-gray-700">{pct(d.pct)} · {brl(d.value)}</span>
                </button>
              </li>
            ))}
            {despesasOcultas.map(d => (
              <li key={d.name}>
                <button type="button" onClick={() => alternarCategoria(d.name)} title="Trazer de volta ao cálculo"
                  className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-gray-400 hover:bg-gray-50">
                  <span className="inline-flex items-center gap-2 min-w-0"><span className="h-3 w-3 shrink-0 rounded-full border border-gray-300" /><span className="truncate line-through">{d.name}</span></span>
                  <span className="shrink-0 line-through">{brl(d.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Grafico>
    </div>
  )
}

export function GraficosAlunos({ loading, serieA, novosMes, inativacoesMes, inativosSemData }: {
  loading: boolean
  serieA: LinhaAlunos[]
  novosMes: { rotulo: string; novos: number; reativados: number }[]
  inativacoesMes: PontoMensal[]
  inativosSemData: number
}) {
  return (
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
      <Grafico titulo="Novos alunos" nota="Novo = cadastro novo, que nunca existiu. Reativado = voltou de inativo para ativo (o sistema só registra reativações a partir de 27/10/2026)."
        carregando={loading} vazio={!loading && novosMes.every(l => l.novos === 0 && l.reativados === 0)} mensagemVazio="Nenhum aluno novo ou reativado neste período">
        <ResponsiveContainer width="100%" height={ALTURA}>
          <BarChart data={novosMes} margin={MARGEM}>
            <Grade />
            <XAxis dataKey="rotulo" {...eixoX} />
            <YAxis {...eixoY} allowDecimals={false} />
            <Tooltip />
            <Legend {...legenda} />
            <Bar dataKey="novos" stackId="n" name="Novos (nunca existiram)" fill={COR.recebido} />
            <Bar dataKey="reativados" stackId="n" name="Reativados" fill={COR.base} radius={[4, 4, 0, 0]} />
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
  )
}

export function GraficosModalidades({ loadingDet, porModalidade, fatiasModalidade, fatProf, profSel, setProfSel, professoresFat, nomeProfSel }: {
  loadingDet: boolean
  porModalidade: ReturnType<typeof alunosPorModalidade>
  fatiasModalidade: (LinhaModalidade & { pct: number })[]
  fatProf: ReturnType<typeof faturamentoProfessores>
  profSel: string
  setProfSel: (id: string) => void
  professoresFat: { id: string; nome: string }[]
  nomeProfSel: string | undefined
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Grafico titulo="Alunos por modalidade e esporte" nota="Alunos ativos hoje; quem tem mais de uma modalidade entra em cada uma"
        carregando={loadingDet} vazio={!loadingDet && porModalidade.dados.length === 0} mensagemVazio="Nenhuma matrícula ativa neste recorte" altura={Math.max(160, porModalidade.dados.length * 54 + 70)}>
        <ResponsiveContainer width="100%" height={Math.max(160, porModalidade.dados.length * 54 + 70)}>
          <BarChart data={porModalidade.dados} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }} barSize={26}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} />
            <YAxis type="category" dataKey="modalidade" width={84} tick={{ fontSize: 13 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Legend {...legenda} />
            {porModalidade.esportes.map(e => <Bar key={e} dataKey={e} stackId="m" fill={corEsporte(e)} name={e} />)}
          </BarChart>
        </ResponsiveContainer>
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {fatiasModalidade.map(f => (
            <li key={f.modalidade} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-gray-800">{f.modalidade}</span>
              <span className="text-gray-600"><strong className="text-gray-900">{f.total}</strong> alunos · {pct(f.pct)}</span>
            </li>
          ))}
        </ul>
      </Grafico>

      <Grafico titulo="Faturamento por professor" nota="Entradas recebidas no período. Clique numa barra para ver o professor mês a mês."
        carregando={loadingDet} vazio={!loadingDet && fatProf.ranking.length === 0} mensagemVazio="Nenhuma entrada vinculada a professor neste período"
        altura={Math.max(160, fatProf.ranking.length * 34 + 30)}>
        <ResponsiveContainer width="100%" height={Math.max(160, fatProf.ranking.length * 34 + 30)}>
          <BarChart data={fatProf.ranking} layout="vertical" margin={{ top: 4, right: 70, left: 0, bottom: 0 }} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="professor" width={96} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as { professor: string; total: number; qtd: number; porEsporte: Record<string, number> }
                return (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow">
                    <div className="font-semibold text-gray-900">{d.professor}</div>
                    <div className="text-gray-700">{brl(d.total)} · {d.qtd} {d.qtd === 1 ? 'pagamento' : 'pagamentos'}</div>
                    {Object.entries(d.porEsporte).map(([e, v]) => <div key={e} className="text-gray-500">{e}: {brl(v)}</div>)}
                  </div>
                )
              }} />
            <Bar dataKey="total" name="Faturamento" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d: { id?: string }) => d.id && setProfSel(d.id)}>
              {fatProf.ranking.map(r => <Cell key={r.id} fill={profSel && r.id !== profSel ? '#BBD98A' : COR.marca} />)}
              <LabelList dataKey="total" position="right" formatter={(v: unknown) => `R$ ${brlCurto(Number(v ?? 0))}`} style={{ fontSize: 12, fill: '#374151' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Grafico>

      <Grafico titulo={`Faturamento por mês · ${nomeProfSel ?? 'todos os professores'}`} nota="Colunas: valor recebido no mês. Linha: alunos diferentes que pagaram." largo
        carregando={loadingDet} vazio={!loadingDet && fatProf.porMes.every(p => p.total === 0)} mensagemVazio="Nenhuma entrada deste professor neste período">
        <div className="mb-2">
          <select value={profSel} onChange={e => setProfSel(e.target.value)} aria-label="Professor" className="h-9 border border-gray-200 rounded-lg px-2 text-sm bg-white">
            <option value="">Todos os professores</option>
            {professoresFat.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={ALTURA}>
          <ComposedChart data={fatProf.porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <Grade />
            <XAxis dataKey="rotulo" {...eixoX} />
            <YAxis yAxisId="valor" {...eixoY} tickFormatter={brlCurto} />
            <YAxis yAxisId="alunos" orientation="right" width={36} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip formatter={(v: unknown, nome: unknown) => (nome === 'Alunos que pagaram' ? String(v) : tip(v))} />
            <Legend {...legenda} />
            <Bar yAxisId="valor" dataKey="total" name="Faturamento" fill={COR.marca} radius={[4, 4, 0, 0]} maxBarSize={48} />
            <Line yAxisId="alunos" type="monotone" dataKey="alunos" name="Alunos que pagaram" stroke="#F97316" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Grafico>
    </div>
  )
}

export function GraficosPagamentos({ loading, status, faixas }: {
  loading: boolean
  status: FatiaStatus[]
  faixas: FaixaAtraso[]
}) {
  return (
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
  )
}
