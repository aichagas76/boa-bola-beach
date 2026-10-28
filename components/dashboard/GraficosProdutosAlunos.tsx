'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { FiltroMeses, useJanela } from '@/components/dashboard/FiltroPeriodo'
import { serieMensal, type Evento } from '@/lib/painel-graficos'

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))
const COR = { marca: '#7DC421', vencido: '#DC2626', recebido: '#16A34A', claro: '#FCA5A5' }
const ALTURA = 260
const MARGEM = { top: 8, right: 8, left: 0, bottom: 0 }

function Cartao({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-sm font-semibold text-gray-900">{titulo}</div>
      {nota && <div className="text-xs text-gray-500">{nota}</div>}
      <div className="mt-3" style={{ minHeight: ALTURA }}>{children}</div>
    </div>
  )
}
const Mensagem = ({ texto }: { texto: string }) => <div className="flex items-center justify-center text-center text-sm text-gray-400 px-4" style={{ height: ALTURA }}>{texto}</div>

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-medium text-gray-600">{rotulo}</div>
      <div className="text-kpi-sm mt-0.5 text-gray-900">{valor}</div>
      {nota && <div className="mt-1 text-xs text-gray-500 leading-4">{nota}</div>}
    </div>
  )
}

/** Vendas de produtos do estoque, mês a mês, com 1/3/6/12 meses ou datas escolhidas. */
export function VendasDeProdutos({ hoje }: { hoje: string }) {
  const { unidadeId } = useUnidade()
  const j = useJanela(hoje)
  const { inicio, fim } = j.janela
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [linhas, setLinhas] = useState<{ data: string; quantidade: number; preco_unitario: number }[]>([])

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setCarregando(true)
      setErro(false)
      const r = await buscarTudo((de, ate) => supabase.from('estoque_retiradas').select('data, quantidade, preco_unitario')
        .eq('unidade_id', unidadeId).gte('data', inicio).lte('data', fim).order('data').order('id').range(de, ate))
      if (cancelado) return
      if (r.error) setErro(true)
      else setLinhas((r.data ?? []) as { data: string; quantidade: number; preco_unitario: number }[])
      setCarregando(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId, inicio, fim])

  const valores = useMemo(() => serieMensal(linhas.map<Evento>(l => ({ data: l.data, valor: Number(l.quantidade) * Number(l.preco_unitario) })), j.janela), [linhas, j.janela])
  const itens = useMemo(() => serieMensal(linhas.map<Evento>(l => ({ data: l.data, valor: Number(l.quantidade) })), j.janela), [linhas, j.janela])
  const total = valores.reduce((s, p) => s + p.total, 0)
  const qtd = itens.reduce((s, p) => s + p.total, 0)
  const dados = valores.map((p, i) => ({ ...p, itens: itens[i].total }))

  return (
    <div>
      <div className="mb-3"><FiltroMeses j={j} nome="Vendas de produtos" /></div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Kpi rotulo="Total vendido" valor={carregando ? '...' : brl(total)} nota="no período escolhido" />
        <Kpi rotulo="Média por mês" valor={carregando ? '...' : brl(valores.length ? total / valores.length : 0)} nota={`${valores.length} ${valores.length === 1 ? 'mês' : 'meses'}`} />
        <Kpi rotulo="Itens vendidos" valor={carregando ? '...' : String(qtd)} />
      </div>
      <Cartao titulo="Vendas de produtos por mês" nota="Valor de cada venda (preço × quantidade), pela data da venda, na unidade escolhida">
        {carregando ? <Mensagem texto="Carregando..." /> : erro ? <Mensagem texto="Não consegui carregar as vendas. Atualize a página." /> : total === 0 ? <Mensagem texto="Nenhuma venda neste período" /> : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={dados} margin={MARGEM}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis width={52} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={brlCurto} />
              <Tooltip formatter={(v: unknown, nome: unknown) => (nome === 'Itens' ? String(v) : brl(Number(v ?? 0)))} />
              <Bar dataKey="total" name="Vendido" fill={COR.marca} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Cartao>
    </div>
  )
}

type Mudanca = { data: string; de_status: string | null; para_status: string; estimado: boolean; alunos: { unidade_id: string | null; matriculas: { esporte_id: string | null }[] | null } | null }

/** Inativações (ativo -> inativo) e reativações (inativo -> ativo) por mês. */
export function MovimentoDeAlunos({ hoje }: { hoje: string }) {
  const { unidadeId } = useUnidade()
  const j = useJanela(hoje)
  const { inicio, fim } = j.janela
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [linhas, setLinhas] = useState<Mudanca[]>([])
  const [esporte, setEsporte] = useState('')
  const [esportes, setEsportes] = useState<{ id: string; nome: string }[]>([])

  useEffect(() => {
    supabase.from('esportes').select('id, nome').eq('ativo', true).order('nome').then(({ data }) => setEsportes(data ?? []))
  }, [])

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setCarregando(true)
      setErro(false)
      const r = await buscarTudo((de, ate) => supabase.from('alunos_status_historico').select('data, de_status, para_status, estimado, alunos(unidade_id, matriculas(esporte_id))')
        .gte('data', inicio).lte('data', fim).order('data').order('id').range(de, ate))
      if (cancelado) return
      if (r.error) setErro(true)
      else setLinhas(((r.data ?? []) as unknown as Mudanca[]).filter(l => l.alunos?.unidade_id === unidadeId))
      setCarregando(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId, inicio, fim])

  // Esporte escolhido: só os alunos que têm matrícula nele
  const doEsporte = useMemo(() => (esporte ? linhas.filter(l => (l.alunos?.matriculas ?? []).some(m => m.esporte_id === esporte)) : linhas), [linhas, esporte])
  const inativacoes = useMemo(() => serieMensal(
    doEsporte.filter(l => l.para_status === 'Inativo').map<Evento>(l => ({ data: l.data, grupo: l.estimado ? 'estimado' : 'registrado' })), j.janela, ['registrado', 'estimado']), [doEsporte, j.janela])
  const reativacoes = useMemo(() => serieMensal(
    doEsporte.filter(l => l.de_status === 'Inativo' && l.para_status === 'Ativo').map<Evento>(l => ({ data: l.data, grupo: 'registrado' })), j.janela, ['registrado']), [doEsporte, j.janela])
  const totalIn = inativacoes.reduce((s, p) => s + p.total, 0)
  const totalRe = reativacoes.reduce((s, p) => s + p.total, 0)
  const estimadas = inativacoes.reduce((s, p) => s + Number(p.estimado), 0)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <FiltroMeses j={j} nome="Inativações e reativações" />
        <select value={esporte} onChange={e => setEsporte(e.target.value)} aria-label="Esporte" className="h-9 shrink-0 border border-gray-200 rounded-lg px-2 text-sm bg-white">
          <option value="">Todos os esportes</option>
          {esportes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Kpi rotulo="Inativações" valor={carregando ? '...' : String(totalIn)} nota="alunos que passaram de ativo a inativo" />
        <Kpi rotulo="Reativações" valor={carregando ? '...' : String(totalRe)} nota="alunos que voltaram de inativo a ativo" />
        <Kpi rotulo="Saldo" valor={carregando ? '...' : `${totalRe - totalIn > 0 ? '+' : ''}${totalRe - totalIn}`} nota="reativações − inativações" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cartao titulo="Inativações por mês" nota={estimadas > 0 ? `${estimadas} com data estimada pelo último pagamento (alunos que já vinham inativos da planilha antiga)` : undefined}>
          {carregando ? <Mensagem texto="Carregando..." /> : erro ? <Mensagem texto="Não consegui carregar. Atualize a página." /> : totalIn === 0 ? <Mensagem texto="Nenhuma inativação neste período" /> : (
            <ResponsiveContainer width="100%" height={ALTURA}>
              <BarChart data={inativacoes} margin={MARGEM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis width={40} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <Bar dataKey="registrado" stackId="i" name="Registrada" fill={COR.vencido} />
                <Bar dataKey="estimado" stackId="i" name="Data estimada" fill={COR.claro} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Cartao>
        <Cartao titulo="Reativações por mês" nota="O sistema passou a registrar as reativações agora; as anteriores não têm data guardada">
          {carregando ? <Mensagem texto="Carregando..." /> : erro ? <Mensagem texto="Não consegui carregar. Atualize a página." /> : totalRe === 0 ? <Mensagem texto="Nenhuma reativação neste período" /> : (
            <ResponsiveContainer width="100%" height={ALTURA}>
              <BarChart data={reativacoes} margin={MARGEM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis width={40} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="registrado" name="Reativações" fill={COR.recebido} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Cartao>
      </div>
    </div>
  )
}
