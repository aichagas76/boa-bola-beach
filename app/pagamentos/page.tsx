'use client'

import { useEffect, useMemo, useState } from 'react'
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
  categoriasDeMensalidade, filtrarPagamentos, foiRecebida, intervaloDoPeriodo, resumoPagamentos, tipoDaEntrada,
  type EntradaAluno, type TipoPeriodo,
} from '@/lib/pagamentos-aluno'

type Linha = EntradaAluno & { forma_pagamento: string | null; alunos: { nome: string } | null }

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
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-')
const grupo = 'inline-flex max-w-full overflow-x-auto rounded-lg border border-gray-200 bg-white'
const botao = (ativo: boolean) => `px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${ativo ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`

export default function PagamentosAluno() {
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
    const r = await buscarTudo((a, b) => supabase
      .from('movimentacoes')
      .select('id, aluno_ref_id, status, valor, data, data_vencimento, data_pagamento, forma_pagamento, categorias_financeiro(categoria), alunos!movimentacoes_aluno_ref_id_fkey(nome)')
      .eq('unidade_id', unidadeId)
      .eq('tipo', 'Entrada')
      .not('aluno_ref_id', 'is', null)
      .order('id').range(a, b))
    if (r.error) { setErro(true); setLoading(false); return }
    setTodas(((r.data ?? []) as unknown as (Omit<Linha, 'categoria'> & { categorias_financeiro: { categoria: string | null } | null })[])
      .map(m => ({ ...m, valor: Number(m.valor), categoria: m.categorias_financeiro?.categoria ?? null })))
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
  const rotuloTipo = tipo === 'todos' ? 'Todos os tipos' : tipo === 'produto' ? 'Venda de produtos' : categoria ? categoria : 'Mensalidades'

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
    <div>
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

      <CabecalhoImpressao titulo="Pagamentos Aluno" unidade={unidade?.nome}
        linhas={[`Período: ${rotuloPeriodo}`, `Tipo: ${rotuloTipo}`, ...(nomeAluno ? [`Aluno: ${nomeAluno}`] : [])]} />

      <div className="flex items-center justify-between gap-3 mb-4 print:hidden pl-12 md:pl-0">
        <h1 className="text-page-title text-gray-900">Pagamentos Aluno</h1>
        <BotaoImprimir desabilitado={loading || lista.length === 0} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4 print:hidden">
        <div>
          <label className="text-label text-gray-500 block mb-2">Período</label>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-label text-gray-500 block mb-2">Tipo</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className={grupo} role="group" aria-label="Tipo">
                {([['todos', 'Todos'], ['mensalidade', 'Mensalidades'], ['produto', 'Venda de produtos']] as const).map(([id, nome]) => (
                  <button key={id} type="button" aria-pressed={tipo === id} onClick={() => { setTipo(id); setCategoria('') }} className={botao(tipo === id)}>{nome}</button>
                ))}
              </div>
            </div>
            {tipo === 'mensalidade' && categorias.length > 0 && (
              <div className={`${grupo} mt-2`} role="group" aria-label="Tipo de mensalidade">
                {['', ...categorias].map(c => (
                  <button key={c || 'todas'} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)}
                    className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${categoria === c ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{c || 'Todas'}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-label text-gray-500 block mb-2">Aluno</label>
            <select value={alunoId} onChange={e => escolherAluno(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Todos</option>
              {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            {alunoId && <p className="mt-1 text-xs text-gray-500">Mostrando o histórico inteiro do aluno. Escolha um período acima para reduzir.</p>}
          </div>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não consegui carregar os pagamentos. Atualize a página; se continuar, avise o suporte.</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 break-inside-avoid">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-label text-gray-500 mb-1">Total pago</div>
          <div className="text-kpi text-green-700">{loading ? '...' : brl(resumo.pago)}</div>
          <div className="text-xs text-gray-500">{resumo.qtdPagos} {resumo.qtdPagos === 1 ? 'pagamento' : 'pagamentos'}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-label text-gray-500 mb-1">Total pendente</div>
          <div className="text-kpi text-yellow-700">{loading ? '...' : brl(resumo.pendente)}</div>
          <div className="text-xs text-gray-500">{resumo.qtdPendentes} em aberto</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-label text-gray-500 mb-1">Último pagamento</div>
          <div className="text-kpi text-gray-700">{loading ? '...' : dataBr(resumo.ultimoPagamento)}</div>
          <div className="text-xs text-gray-500">dentro do filtro</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-th text-gray-500">Competência</th>
                <th className="text-left px-4 py-3 text-th text-gray-500">Aluno</th>
                <th className="text-left px-4 py-3 text-th text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 text-th text-gray-500">Valor</th>
                <th className="text-left px-4 py-3 text-th text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-th text-gray-500">Data pagamento</th>
                <th className="text-left px-4 py-3 text-th text-gray-500">Forma</th>
                <th className="px-4 py-3 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
              {!loading && lista.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhum pagamento neste filtro.</td></tr>}
              {(imprimindo ? lista : pagination.paginatedItems).map(m => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{m.data_vencimento ? new Date(m.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '-'}</td>
                  <td className="px-4 py-3 text-gray-800">{m.alunos?.nome || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.categoria ?? '-'}
                    {tipoDaEntrada(m.categoria) === 'produto' && <span className="ml-1 text-xs text-gray-400">(produto)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium tabular-nums">{brl(Number(m.valor))}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${foiRecebida(m) ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{dataBr(m.data_pagamento)}</td>
                  <td className="px-4 py-3 text-gray-600">{m.forma_pagamento || '-'}</td>
                  <td className="px-4 py-3 print:hidden">
                    <div className="flex gap-2">
                      {m.status === 'Não recebido' && (
                        <button onClick={() => darBaixa(m)} disabled={baixandoId === m.id}
                          className="px-3 py-1 text-sm bg-[#7DC421] text-white rounded-lg hover:bg-[#6ab01a] disabled:opacity-50">{baixandoId === m.id ? '...' : 'Dar baixa'}</button>
                      )}
                      <button onClick={() => setConfirmDelete({ isOpen: true, id: m.id })} disabled={baixandoId === m.id}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">{baixandoId === m.id ? '...' : 'Deletar'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="print:hidden">
          <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} pageSize={pagination.pageSize} onPageChange={pagination.goToPage} />
        </div>
      </div>
    </div>
  )
}
