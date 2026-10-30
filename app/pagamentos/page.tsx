'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Receipt, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { buscarTudo } from '@/lib/buscar-tudo'
import { registrarLog } from '@/lib/log'
import { usePagination } from '@/lib/hooks/usePagination'
import { Pagination } from '@/components/ui/pagination'
import { Modal } from '@/components/ui/modal'
import { avisar } from '@/lib/avisos-ui'
import { BotaoImprimir, CabecalhoImpressao } from '@/components/relatorios/CabecalhoImpressao'
import {
  categoriasDeMensalidade, competenciaCurta, filtrarPagamentos, foiRecebida, intervaloDoPeriodo, normaliza, resumoPagamentos, tipoDaEntrada,
  type EntradaAluno, type TipoPeriodo,
} from '@/lib/pagamentos-aluno'
import { htmlDoRecibo, montarRecibo } from '@/lib/recibo'

type Linha = EntradaAluno & { descricao: string | null; forma_pagamento: string | null; alunos: { nome: string } | null; professores: { nome: string } | null }
type Bruto = Omit<Linha, 'categoria'> & { categorias_financeiro: { categoria: string | null } | null }

const PERIODOS: { id: TipoPeriodo; nome: string }[] = [
  { id: 'dia', nome: 'Do dia' },
  { id: '7dias', nome: '7 dias' },
  { id: 'mes', nome: 'Do mês' },
  { id: 'semestre', nome: 'Do semestre' },
  { id: 'ano', nome: 'Do ano' },
  { id: 'data', nome: 'Data selecionada' },
  { id: 'tudo', nome: 'Todo o histórico' },
]

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const grupo = 'inline-flex max-w-full overflow-x-auto rounded-lg border border-gray-200 bg-white'
const botao = (ativo: boolean) => `px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${ativo ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`
const rotulo = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5'
const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500'

export default function HistoricoFinanceiroAluno() {
  const { unidadeId, unidade } = useUnidade()
  const hoje = useMemo(() => new Date().toLocaleDateString('en-CA'), [])
  const [alunos, setAlunos] = useState<{ id: string; nome: string }[]>([])
  const [todas, setTodas] = useState<Linha[]>([])
  const [periodo, setPeriodo] = useState<TipoPeriodo>('mes')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [tipo, setTipo] = useState<'todos' | 'mensalidade' | 'produto'>('todos')
  const [categoria, setCategoria] = useState('')
  const [alunoId, setAlunoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })
  // Ao imprimir, a lista sai inteira (e não só a página que está na tela)
  const [imprimindo, setImprimindo] = useState(false)
  useEffect(() => {
    const antes = () => setImprimindo(true)
    const depois = () => setImprimindo(false)
    window.addEventListener('beforeprint', antes)
    window.addEventListener('afterprint', depois)
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois) }
  }, [])

  async function carregar() {
    if (!unidadeId) return
    setLoading(true)
    setErro(false)
    const campos = 'id, aluno_ref_id, status, valor, data, data_vencimento, data_pagamento, forma_pagamento, descricao'
    const [comAluno, semAluno] = await Promise.all([
      // O que é de aluno: mensalidades e vendas ligadas a ele
      buscarTudo((a, b) => supabase.from('movimentacoes')
        .select(`${campos}, categorias_financeiro(categoria), alunos!movimentacoes_aluno_ref_id_fkey(nome), professores(nome)`)
        .eq('unidade_id', unidadeId).eq('tipo', 'Entrada').not('aluno_ref_id', 'is', null).order('id').range(a, b)),
      // Venda de produto sem aluno (balcão ou professor)
      buscarTudo((a, b) => supabase.from('movimentacoes')
        .select(`${campos}, categorias_financeiro!inner(categoria), alunos!movimentacoes_aluno_ref_id_fkey(nome), professores(nome)`)
        .eq('unidade_id', unidadeId).eq('tipo', 'Entrada').is('aluno_ref_id', null).ilike('categorias_financeiro.categoria', '%produto%').order('id').range(a, b)),
    ])
    if (comAluno.error || semAluno.error) { setErro(true); setLoading(false); return }
    const brutos = [...((comAluno.data ?? []) as unknown as Bruto[]), ...((semAluno.data ?? []) as unknown as Bruto[])]
    setTodas(brutos.map(m => ({ ...m, valor: Number(m.valor), categoria: m.categorias_financeiro?.categoria ?? null })))
    setLoading(false)
  }

  useEffect(() => {
    buscarTudo((a, b) => supabase.from('alunos').select('id, nome').order('nome').order('id').range(a, b)).then(({ data }) => setAlunos(data ?? []))
    carregar()
  }, [unidadeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escolher um aluno mostra o histórico inteiro dele; dá para voltar a um período depois
  function escolherAluno(id: string) {
    setAlunoId(id)
    setPeriodo(id ? 'tudo' : 'mes')
  }

  const intervalo = useMemo(() => intervaloDoPeriodo(periodo, hoje, de, ate), [periodo, hoje, de, ate])
  const categorias = useMemo(() => categoriasDeMensalidade(todas), [todas])
  const lista = useMemo(() => filtrarPagamentos(todas, { periodo: intervalo, tipo, categoria, alunoId }) as Linha[], [todas, intervalo, tipo, categoria, alunoId])
  const resumo = useMemo(() => resumoPagamentos(lista), [lista])
  const pagination = usePagination(lista, 15)
  const nomeAluno = alunos.find(a => a.id === alunoId)?.nome

  const rotuloPeriodo = periodo === 'tudo' ? 'Todo o histórico'
    : intervalo.inicio === intervalo.fim ? dataBr(intervalo.inicio) : `${dataBr(intervalo.inicio)} a ${dataBr(intervalo.fim)}`
  const rotuloTipo = tipo === 'todos' ? 'Todos os tipos' : tipo === 'produto' ? 'Venda de produtos' : categoria || 'Mensalidades'
  const quem = (m: Linha) => m.alunos?.nome ?? (m.professores?.nome ? `${m.professores.nome} (professor)` : 'Venda de balcão')

  // Recibo de quem pagou em dinheiro: abre uma página com o logo, pronta para imprimir ou salvar em PDF
  function gerarRecibo(m: Linha) {
    const recibo = montarRecibo({
      id: m.id, quem: quem(m), valor: Number(m.valor), categoria: m.categoria, produto: tipoDaEntrada(m.categoria) === 'produto',
      descricao: m.descricao, competencia: m.data_vencimento ?? m.data, dataPagamento: m.data_pagamento ?? m.data, unidade: unidade?.nome ?? 'Boa Bola', forma: m.forma_pagamento ?? 'Dinheiro',
    })
    const janela = window.open('', '_blank', 'width=900,height=700')
    if (!janela) { avisar('O navegador bloqueou a janela do recibo. Libere os pop-ups deste site e clique de novo.'); return }
    janela.document.write(htmlDoRecibo(recibo, unidade?.nome ?? 'Boa Bola', `${window.location.origin}/BB%20logo.jpg`))
    janela.document.close()
  }

  async function darBaixa(m: Linha) {
    setBaixandoId(m.id)
    const { error } = await supabase.from('movimentacoes').update({ status: 'Recebido', data_pagamento: new Date().toLocaleDateString('en-CA') }).eq('id', m.id)
    if (error) { avisar('Erro: ' + error.message); setBaixandoId(null); return }
    await registrarLog('Baixa pagamento', 'movimentacoes', m.id, 'Pagamento')
    setBaixandoId(null)
    carregar()
  }

  async function confirmarDelete() {
    if (!confirmDelete.id) return
    const id = confirmDelete.id
    setBaixandoId(id)
    const { error } = await supabase.from('movimentacoes').delete().eq('id', id)
    setConfirmDelete({ isOpen: false, id: null })
    if (error) { avisar('Erro: ' + error.message); setBaixandoId(null); return }
    await registrarLog('Deletou pagamento', 'movimentacoes', id, 'Pagamento')
    setBaixandoId(null)
    carregar()
  }

  return (
    <div className="max-w-6xl">
      <Modal
        isOpen={confirmDelete.isOpen}
        title="Deletar pagamento"
        message="Tem certeza que deseja deletar este pagamento? Esta ação não pode ser desfeita."
        confirmText="Deletar"
        cancelText="Cancelar"
        isDestructive
        onConfirm={confirmarDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
      />

      <CabecalhoImpressao titulo="Histórico Financeiro Aluno" unidade={unidade?.nome}
        linhas={[`Período: ${rotuloPeriodo}`, `Tipo: ${rotuloTipo}`, ...(nomeAluno ? [`Aluno: ${nomeAluno}`] : [])]} />

      <div className="flex flex-wrap items-end justify-between gap-3 mb-5 print:hidden pl-12 md:pl-0">
        <div>
          <h1 className="text-page-title text-gray-900">Histórico Financeiro Aluno</h1>
          <p className="text-sm text-gray-500">{unidade?.nome ?? ''} · mensalidades e vendas de produtos, com o que foi pago e o que está em aberto</p>
        </div>
        <BotaoImprimir desabilitado={loading || lista.length === 0} />
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-5 print:hidden" aria-label="Filtros">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-5">
          <div className="lg:col-span-2">
            <span className={rotulo}>Período</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className={grupo} role="group" aria-label="Período">
                {PERIODOS.map(p => (
                  <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)} className={botao(periodo === p.id)}>{p.nome}</button>
                ))}
              </div>
              {periodo === 'data' && (
                <div className="inline-flex shrink-0 items-center gap-2 text-sm text-gray-600">
                  <input type="date" value={de} onChange={e => setDe(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="De" />
                  até
                  <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="h-9 w-[8.25rem] border border-gray-200 rounded-lg px-2 text-sm bg-white" aria-label="Até" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="filtro-aluno" className={rotulo}>Aluno</label>
            <select id="filtro-aluno" value={alunoId} onChange={e => escolherAluno(e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm bg-white">
              <option value="">Todos os alunos</option>
              {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            {alunoId && <p className="mt-1 text-xs text-gray-500">Histórico inteiro do aluno. Escolha um período para reduzir.</p>}
          </div>

          <div className="lg:col-span-3">
            <span className={rotulo}>Tipo</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className={grupo} role="group" aria-label="Tipo">
                {([['todos', 'Todos'], ['mensalidade', 'Mensalidades'], ['produto', 'Venda de produtos']] as const).map(([id, nome]) => (
                  <button key={id} type="button" aria-pressed={tipo === id} onClick={() => { setTipo(id); setCategoria('') }} className={botao(tipo === id)}>{nome}</button>
                ))}
              </div>
              {tipo === 'mensalidade' && categorias.length > 0 && (
                <div className={grupo} role="group" aria-label="Tipo de mensalidade">
                  {['', ...categorias].map(c => (
                    <button key={c || 'todas'} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)}
                      className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${categoria === c ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{c || 'Todas'}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não consegui carregar os pagamentos. Atualize a página; se continuar, avise o suporte.</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 break-inside-avoid">
        {[
          { titulo: 'Total pago', valor: brl(resumo.pago), nota: `${resumo.qtdPagos} ${resumo.qtdPagos === 1 ? 'pagamento' : 'pagamentos'}`, cor: 'text-green-700', borda: 'border-l-green-500' },
          { titulo: 'Em aberto', valor: brl(resumo.pendente), nota: `${resumo.qtdPendentes} ${resumo.qtdPendentes === 1 ? 'lançamento' : 'lançamentos'}`, cor: 'text-amber-700', borda: 'border-l-amber-400' },
          { titulo: 'Último pagamento', valor: dataBr(resumo.ultimoPagamento), nota: 'dentro do filtro', cor: 'text-gray-800', borda: 'border-l-gray-300' },
        ].map(k => (
          <div key={k.titulo} className={`bg-white border border-gray-200 border-l-4 ${k.borda} rounded-xl p-4`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k.titulo}</div>
            <div className={`mt-1 text-kpi ${k.cor}`}>{loading ? '...' : k.valor}</div>
            <div className="text-xs text-gray-500">{k.nota}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[44rem]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className={th}>Comp.</th>
                <th className={th}>Aluno / comprador</th>
                <th className={th}>Tipo</th>
                <th className={`${th} text-right`}>Valor</th>
                <th className={th}>Status</th>
                <th className={th}>Pago em</th>
                <th className={th}>Forma</th>
                <th className={`${th} text-right print:hidden`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Carregando...</td></tr>}
              {!loading && lista.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Nenhum lançamento neste filtro.</td></tr>}
              {(imprimindo ? lista : pagination.paginatedItems).map(m => {
                const produto = tipoDaEntrada(m.categoria) === 'produto'
                return (
                  <tr key={m.id} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/40 hover:bg-blue-50/40">
                    <td className="px-4 py-2.5 tabular-nums text-gray-700">{competenciaCurta(m.data_vencimento ?? m.data)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{quem(m)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${produto ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{produto ? 'Produto' : (m.categoria ?? 'Mensalidade')}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">{brl(Number(m.valor))}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${foiRecebida(m) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{foiRecebida(m) ? 'Pago' : (m.status ?? 'Em aberto')}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-600">{dataBr(m.data_pagamento)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{m.forma_pagamento || '—'}</td>
                    <td className="px-4 py-2.5 print:hidden">
                      <div className="flex justify-end gap-1.5">
                        {foiRecebida(m) && normaliza(m.forma_pagamento) === 'dinheiro' && (
                          <button onClick={() => gerarRecibo(m)} title="Gerar recibo (pago em dinheiro)" aria-label="Gerar recibo"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-blue-700 hover:bg-blue-50"><Receipt size={16} /></button>
                        )}
                        {m.status === 'Não recebido' && (
                          <button onClick={() => darBaixa(m)} disabled={baixandoId === m.id} title="Dar baixa" aria-label="Dar baixa"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#7DC421] text-white hover:bg-[#6ab01a] disabled:opacity-50"><Check size={16} /></button>
                        )}
                        <button onClick={() => setConfirmDelete({ isOpen: true, id: m.id })} disabled={baixandoId === m.id} title="Deletar" aria-label="Deletar"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {lista.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-900">
                  <td className="px-4 py-3" colSpan={3}>Total do filtro ({lista.length})</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(resumo.pago + resumo.pendente)}</td>
                  <td className="px-4 py-3 text-xs font-normal text-gray-500" colSpan={4}>pago {brl(resumo.pago)} · em aberto {brl(resumo.pendente)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="print:hidden">
          <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} pageSize={pagination.pageSize} onPageChange={pagination.goToPage} />
        </div>
      </div>
    </div>
  )
}
