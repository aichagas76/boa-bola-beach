'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesesAtras } from '@/lib/periodo'
import { Receipt, X } from 'lucide-react'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { normaliza } from '@/lib/pagamentos-aluno'
import { abrirRecibo } from '@/lib/recibo-ui'

type Linha = {
  id: string
  data: string
  data_vencimento: string | null
  data_pagamento: string | null
  descricao: string | null
  valor: number
  forma_pagamento: string | null
  status: string | null
  origem: string | null
  categorias_financeiro: { categoria: string; subcategoria: string | null } | null
}

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')
const pago = (l: Linha) => l.status === 'Recebido' || l.status === 'Pago'
const ehProduto = (l: Linha) => l.origem === 'Estoque' || /produto/i.test(l.categorias_financeiro?.categoria ?? '')

/** Tudo o que o aluno já pagou ou ainda deve: mensalidades, retiradas de produtos e demais lançamentos. */
export default function HistoricoAluno({ aluno, onFechar }: { aluno: { id: string; nome: string }; onFechar: () => void }) {
  const { unidade } = useUnidade()
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'mensalidade' | 'produto'>('todos')
  const [meses, setMeses] = useState<0 | 1 | 3 | 6>(0) // 0 = todo o histórico

  useEffect(() => {
    let ativo = true
    supabase.from('movimentacoes')
      .select('id, data, data_vencimento, data_pagamento, descricao, valor, forma_pagamento, status, origem, categorias_financeiro(categoria, subcategoria)')
      .eq('aluno_ref_id', aluno.id).eq('tipo', 'Entrada')
      .order('data_vencimento', { ascending: false }).limit(1000)
      .then(({ data }) => { if (ativo) setLinhas((data ?? []) as unknown as Linha[]) })
    return () => { ativo = false }
  }, [aluno.id])

  // Últimos N meses: do mesmo dia N meses atrás em diante (o que ainda vai vencer continua aparecendo)
  const desde = meses ? mesesAtras(new Date().toLocaleDateString('en-CA'), meses) : ''
  const lista = (linhas ?? [])
    .filter(l => filtro === 'todos' || (filtro === 'produto' ? ehProduto(l) : !ehProduto(l)))
    .filter(l => !desde || (l.data_vencimento ?? l.data) >= desde)
  const totalPago = lista.filter(pago).reduce((a, l) => a + Number(l.valor), 0)
  const totalAberto = lista.filter(l => !pago(l)).reduce((a, l) => a + Number(l.valor), 0)
  const chip = (id: typeof filtro, texto: string) => (
    <button key={id} onClick={() => setFiltro(id)}
      className={`h-9 px-3 rounded-full text-sm font-medium border transition-colors ${filtro === id ? 'bg-[#7DC421] text-white border-[#7DC421]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{texto}</button>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-section-title text-gray-900">Histórico de pagamentos</h2>
            <div className="text-sm text-gray-500">{aluno.nome}</div>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600" title="Fechar"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {chip('todos', 'Tudo')}{chip('mensalidade', 'Mensalidades e outros')}{chip('produto', 'Produtos')}
          <div className="ml-auto flex gap-4 text-sm">
            <span className="text-gray-500">Pago: <b className="text-green-600">{moeda(totalPago)}</b></span>
            <span className="text-gray-500">Em aberto: <b className="text-amber-600">{moeda(totalAberto)}</b></span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-label text-gray-500">Período</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {([[0, 'Tudo'], [1, '1 mês'], [3, '3 meses'], [6, '6 meses']] as const).map(([n, texto], i) => (
              <button key={n} type="button" aria-pressed={meses === n} onClick={() => setMeses(n)}
                className={`h-9 px-3 text-sm whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${meses === n ? 'bg-gray-900 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{texto}</button>
            ))}
          </div>
        </div>

        <div className="overflow-auto border border-gray-200 rounded-lg">
          {linhas === null ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : lista.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Nenhum lançamento deste aluno.</div>
          ) : (
            <table className="w-full text-sm whitespace-nowrap border-separate border-spacing-0">
              <thead className="sticky top-0 bg-gray-50 [&>tr>th]:border-b [&>tr>th]:border-gray-200">
                <tr>
                  {['Vencimento', 'Pagamento', 'Descrição', 'Categoria', 'Meio', 'Valor', 'Pago?', 'Recibo'].map((t, i) => (
                    <th key={t} className={`${i === 5 ? 'text-right' : i >= 6 ? 'text-center' : 'text-left'} px-3 h-10 text-th text-gray-600`}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr>td]:border-b [&>tr>td]:border-gray-100">
                {lista.map(l => (
                  <tr key={l.id} className="h-11">
                    <td className="px-3 tabular-nums text-gray-700">{dataBr(l.data_vencimento ?? l.data)}</td>
                    <td className="px-3 tabular-nums text-gray-700">{dataBr(l.data_pagamento)}</td>
                    <td className="px-3 text-gray-800 max-w-[11rem] truncate" title={l.descricao ?? ''}>{l.descricao || '—'}</td>
                    <td className="px-3 text-gray-600">
                      {l.categorias_financeiro ? `${l.categorias_financeiro.categoria}${l.categorias_financeiro.subcategoria ? ' / ' + l.categorias_financeiro.subcategoria : ''}` : '—'}
                    </td>
                    <td className="px-3 text-gray-600">{l.forma_pagamento ?? '—'}</td>
                    <td className="px-3 text-right font-semibold tabular-nums text-green-600">{moeda(Number(l.valor))}</td>
                    <td className="px-3 text-center">
                      <span className={`inline-flex min-w-[3rem] justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${pago(l) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`} title={l.status ?? ''}>{pago(l) ? 'Sim' : 'Não'}</span>
                    </td>
                    <td className="px-3 text-center">
                      {pago(l) && normaliza(l.forma_pagamento) === 'dinheiro' ? (
                        <button type="button" title="Gerar recibo (pago em dinheiro)" aria-label="Gerar recibo"
                          onClick={() => abrirRecibo({
                            id: l.id, quem: aluno.nome, valor: Number(l.valor), categoria: l.categorias_financeiro?.categoria ?? null, produto: ehProduto(l),
                            descricao: l.descricao, competencia: l.data_vencimento ?? l.data, dataPagamento: l.data_pagamento ?? l.data, unidade: unidade?.nome ?? 'Boa Bola', forma: l.forma_pagamento ?? 'Dinheiro',
                          })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-blue-700 hover:bg-blue-50"><Receipt size={16} /></button>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
