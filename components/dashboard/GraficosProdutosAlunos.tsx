'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { FiltroMeses, useJanela } from '@/components/dashboard/FiltroPeriodo'
import { serieMensal, type Evento } from '@/lib/painel-graficos'

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))
const COR = { marca: '#7DC421' }
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
  const [linhas, setLinhas] = useState<{ data: string; valor: number }[]>([])

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setCarregando(true)
      setErro(false)
      // As vendas (as antigas da planilha e as novas do Estoque) ficam no Financeiro como entrada "Venda Produto Loja"
      const r = await buscarTudo((de, ate) => supabase.from('movimentacoes').select('data, valor, categorias_financeiro!inner(categoria)')
        .eq('unidade_id', unidadeId).eq('tipo', 'Entrada').not('status', 'in', '(Cancelado,Estornado)')
        .ilike('categorias_financeiro.categoria', '%Venda%Produto%')
        .gte('data', inicio).lte('data', fim).order('data').order('id').range(de, ate))
      if (cancelado) return
      if (r.error) setErro(true)
      else setLinhas((r.data ?? []) as unknown as { data: string; valor: number }[])
      setCarregando(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId, inicio, fim])

  const valores = useMemo(() => serieMensal(linhas.map<Evento>(l => ({ data: l.data, valor: Number(l.valor) })), j.janela), [linhas, j.janela])
  const total = valores.reduce((s, p) => s + p.total, 0)
  const qtd = valores.reduce((s, p) => s + p.qtd, 0)

  return (
    <div>
      <div className="mb-3"><FiltroMeses j={j} nome="Vendas de produtos" /></div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Kpi rotulo="Total vendido" valor={carregando ? '...' : brl(total)} nota="no período escolhido" />
        <Kpi rotulo="Média por mês" valor={carregando ? '...' : brl(valores.length ? total / valores.length : 0)} nota={`${valores.length} ${valores.length === 1 ? 'mês' : 'meses'}`} />
        <Kpi rotulo="Vendas lançadas" valor={carregando ? '...' : String(qtd)} nota="quantidade de lançamentos de venda" />
      </div>
      <Cartao titulo="Vendas de produtos por mês" nota="Entradas de venda de produtos da loja lançadas no Financeiro (inclui as antigas da planilha), pela data da venda, na unidade escolhida">
        {carregando ? <Mensagem texto="Carregando..." /> : erro ? <Mensagem texto="Não consegui carregar as vendas. Atualize a página." /> : total === 0 ? <Mensagem texto="Nenhuma venda neste período" /> : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={valores} margin={MARGEM}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis width={52} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={brlCurto} />
              <Tooltip formatter={(v: unknown) => brl(Number(v ?? 0))} />
              <Bar dataKey="total" name="Vendido" fill={COR.marca} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Cartao>
    </div>
  )
}
