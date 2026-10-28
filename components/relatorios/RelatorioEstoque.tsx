'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { FiltroMeses, rotuloDoPeriodo, useJanela } from '@/components/dashboard/FiltroPeriodo'
import { BotaoImprimir, CabecalhoImpressao } from '@/components/relatorios/CabecalhoImpressao'
import { relatorioEstoque, type CompraEstoque, type ProdutoEstoque, type RetiradaEstoque } from '@/lib/relatorios-gerenciais'

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const COR_SITUACAO: Record<string, string> = { COMPRAR: 'bg-red-50 text-red-700', 'ATENÇÃO': 'bg-amber-50 text-amber-700', OK: 'bg-green-50 text-green-700' }

/** Vendas, lucro, compras e saldo de cada produto do Estoque, no período escolhido. */
export default function RelatorioEstoque({ hoje }: { hoje: string }) {
  const { unidadeId, unidade } = useUnidade()
  const j = useJanela(hoje, 3)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([])
  const [retiradas, setRetiradas] = useState<RetiradaEstoque[]>([])
  const [compras, setCompras] = useState<CompraEstoque[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setCarregando(true)
      setErro(false)
      const [rp, rr, rc, rs] = await Promise.all([
        supabase.from('estoque_produtos').select('id, nome, categoria, custo, limite_compra').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
        buscarTudo((de, ate) => supabase.from('estoque_retiradas').select('produto_id, data, quantidade, preco_unitario, custo_unitario').eq('unidade_id', unidadeId).order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('estoque_compras').select('produto_id, data, quantidade, custo_unitario').eq('unidade_id', unidadeId).order('id').range(de, ate)),
        supabase.from('estoque_saldos').select('produto_id, saldo'),
      ])
      if (cancelado) return
      if (rp.error || rr.error || rc.error || rs.error) { setErro(true); setCarregando(false); return }
      setProdutos((rp.data ?? []).map(x => ({ ...x, custo: Number(x.custo), limite_compra: Number(x.limite_compra) })) as ProdutoEstoque[])
      setRetiradas((rr.data ?? []).map(x => ({ ...x, quantidade: Number(x.quantidade), preco_unitario: Number(x.preco_unitario), custo_unitario: Number(x.custo_unitario) })) as RetiradaEstoque[])
      setCompras((rc.data ?? []).map(x => ({ ...x, quantidade: Number(x.quantidade), custo_unitario: Number(x.custo_unitario) })) as CompraEstoque[])
      setSaldos(Object.fromEntries((rs.data ?? []).map((x: { produto_id: string; saldo: number }) => [x.produto_id, Number(x.saldo)])))
      setCarregando(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId])

  const r = useMemo(() => relatorioEstoque({ produtos, retiradas, compras, saldos, inicio: j.janela.inicio, fim: j.janela.fim }), [produtos, retiradas, compras, saldos, j.janela])
  const periodo = rotuloDoPeriodo(j.janela.inicio, j.janela.fim)

  return (
    <section>
      <CabecalhoImpressao titulo="Relatório de estoque" unidade={unidade?.nome} linhas={[`Período: ${periodo}`]} />
      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <FiltroMeses j={j} nome="Estoque" />
        <div className="ml-auto"><BotaoImprimir desabilitado={carregando} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { rotulo: 'Faturamento', valor: brl(r.totais.faturamento), nota: 'vendas do Estoque no período' },
          { rotulo: 'Lucro', valor: brl(r.totais.lucro), nota: 'preço − custo dos produtos vendidos' },
          { rotulo: 'Itens vendidos', valor: String(r.totais.vendidos), nota: 'unidades' },
          { rotulo: 'Gasto em compras', valor: brl(r.totais.gastoCompras), nota: 'compras do período' },
        ].map(k => (
          <div key={k.rotulo} className="bg-white border border-gray-200 rounded-xl p-4 break-inside-avoid">
            <div className="text-sm text-gray-600">{k.rotulo}</div>
            <div className="text-kpi text-gray-900">{carregando ? '...' : k.valor}</div>
            <div className="text-xs text-gray-500">{k.nota}</div>
          </div>
        ))}
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não consegui carregar o estoque. Atualize a página; se continuar, avise o suporte.</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-3 py-2.5 text-th text-gray-500">Produto</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Vendidos</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Faturamento</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Lucro</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Comprados</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Gasto em compras</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Saldo hoje</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Situação</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
            {!carregando && r.linhas.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhum produto cadastrado nesta unidade.</td></tr>}
            {r.linhas.map(l => (
              <tr key={l.id} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2.5 text-gray-900">{l.nome}{l.categoria && <span className="text-gray-400"> · {l.categoria}</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{l.vendidos || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{l.faturamento ? brl(l.faturamento) : '—'}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${l.lucro < 0 ? 'text-red-600' : 'text-gray-900'}`}>{l.vendidos ? brl(l.lucro) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{l.comprados || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{l.gastoCompras ? brl(l.gastoCompras) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{l.saldo}</td>
                <td className="px-3 py-2.5 text-right"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${COR_SITUACAO[l.situacao]}`}>{l.situacao}</span></td>
              </tr>
            ))}
          </tbody>
          {r.linhas.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-gray-900">
                <td className="px-3 py-3">Total</td>
                <td className="px-3 py-3 text-right">{r.totais.vendidos}</td>
                <td className="px-3 py-3 text-right">{brl(r.totais.faturamento)}</td>
                <td className="px-3 py-3 text-right">{brl(r.totais.lucro)}</td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-right">{brl(r.totais.gastoCompras)}</td>
                <td className="px-3 py-3" colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Só entram as vendas feitas pelo Estoque do sistema. As vendas antigas da planilha ficam no Financeiro (veja o gráfico Vendas de produtos no Painel) e não têm produto nem quantidade.
        Situação: COMPRAR = acabou; ATENÇÃO = no limite de compra ou abaixo dele. O saldo é o de hoje, qualquer que seja o período.
      </p>
    </section>
  )
}
