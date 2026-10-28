'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { FiltroPeriodo, rotuloDoPeriodo, usePeriodo } from '@/components/dashboard/FiltroPeriodo'
import { BotaoImprimir, CabecalhoImpressao } from '@/components/relatorios/CabecalhoImpressao'
import { compararPeriodos, type AlunoComparacao, type MovComparacao } from '@/lib/relatorios-gerenciais'

const brl = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Indicadores do período escolhido contra o período anterior de mesmo tamanho. */
export default function ComparacaoPeriodos({ hoje }: { hoje: string }) {
  const { unidadeId, unidade } = useUnidade()
  const p = usePeriodo(hoje)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [movs, setMovs] = useState<MovComparacao[]>([])
  const [alunos, setAlunos] = useState<AlunoComparacao[]>([])

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setCarregando(true)
      setErro(false)
      const corte = `${new Date().getFullYear() - 2}-01-01`
      const [rf, rc, ra, rh] = await Promise.all([
        buscarTudo((de, ate) => supabase.from('movimentacoes').select('tipo, status, valor, data, data_pagamento, categoria_id')
          .eq('unidade_id', unidadeId).or(`data.gte.${corte},data_pagamento.gte.${corte}`).order('id').range(de, ate)),
        supabase.from('categorias_financeiro').select('id, categoria'),
        buscarTudo((de, ate) => supabase.from('alunos').select('id, data_cadastro, data_inativacao, unidade_id').eq('unidade_id', unidadeId).order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('alunos_status_historico').select('aluno_id, data').eq('para_status', 'Inativo').order('data').order('id').range(de, ate)),
      ])
      if (cancelado) return
      if (rf.error || rc.error || ra.error) { setErro(true); setCarregando(false); return }
      const nomeCat = new Map((rc.data ?? []).map(c => [c.id as string, c.categoria as string | null]))
      setMovs(((rf.data ?? []) as unknown as (Omit<MovComparacao, 'categoria'> & { categoria_id: string | null })[])
        .map(m => ({ tipo: m.tipo, status: m.status, valor: Number(m.valor), data: m.data, data_pagamento: m.data_pagamento, categoria: m.categoria_id ? nomeCat.get(m.categoria_id) ?? null : null })))
      // Data de saída: a registrada no aluno ou, se não houver, a do histórico (que inclui as estimadas dos alunos importados)
      const saida = new Map(((rh.error ? [] : rh.data) ?? []).map(x => [x.aluno_id as string, x.data as string]))
      setAlunos(((ra.data ?? []) as unknown as { id: string; data_cadastro: string | null; data_inativacao: string | null }[])
        .map(a => ({ data_cadastro: a.data_cadastro, data_saida: a.data_inativacao ?? saida.get(a.id) ?? null })))
      setCarregando(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId])

  const periodo = p.periodo
  const linhas = useMemo(() => compararPeriodos({
    movs, alunos,
    atual: { inicio: periodo.inicio, fim: periodo.fim },
    anterior: { inicio: periodo.inicioAnt, fim: periodo.fimAnt },
  }), [movs, alunos, periodo])

  const valor = (v: number, dinheiro: boolean) => (dinheiro ? brl(v) : String(v))

  return (
    <section>
      <CabecalhoImpressao titulo="Comparação entre períodos" unidade={unidade?.nome}
        linhas={[`Período: ${rotuloDoPeriodo(periodo.inicio, periodo.fim)}`, `Comparado com: ${rotuloDoPeriodo(periodo.inicioAnt, periodo.fimAnt)}`]} />
      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <FiltroPeriodo p={p} nome="Comparação" />
        <div className="ml-auto"><BotaoImprimir desabilitado={carregando} /></div>
      </div>
      <p className="mb-3 text-sm text-gray-600 print:hidden">
        <strong className="text-gray-900">{rotuloDoPeriodo(periodo.inicio, periodo.fim)}</strong> comparado com o período anterior de mesmo tamanho,{' '}
        <strong className="text-gray-900">{rotuloDoPeriodo(periodo.inicioAnt, periodo.fimAnt)}</strong>.
      </p>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não consegui carregar os dados. Atualize a página; se continuar, avise o suporte.</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-3 py-2.5 text-th text-gray-500">Indicador</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Período escolhido</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Período anterior</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Diferença</th>
              <th className="px-3 py-2.5 text-th text-gray-500 text-right">Variação</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
            {!carregando && linhas.map(l => {
              const bom = l.diferenca === 0 ? null : (l.diferenca > 0) === l.subiuEhBom
              const cor = bom === null ? 'text-gray-500' : bom ? 'text-green-700' : 'text-red-600'
              return (
                <tr key={l.chave} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-3 font-medium text-gray-900">{l.rotulo}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-900">{valor(l.atual, l.dinheiro)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">{valor(l.anterior, l.dinheiro)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${cor}`}>{l.diferenca > 0 ? '+' : ''}{valor(l.diferenca, l.dinheiro)}</td>
                  <td className={`px-3 py-3 text-right ${cor}`}>
                    {l.variacaoPct === null ? <span className="text-gray-400">sem base</span> : (
                      <span className="inline-flex items-center gap-1">
                        {l.diferenca === 0 ? <Minus size={14} /> : l.diferenca > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(l.variacaoPct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Faturamento = entradas recebidas; despesas = saídas pagas (pela data do pagamento); vendas de produtos = entradas da categoria de venda de produtos.
        Despesa que sobe aparece em vermelho. As inativações dos alunos que vieram da planilha antiga usam a data estimada pelo último pagamento.
      </p>
    </section>
  )
}
