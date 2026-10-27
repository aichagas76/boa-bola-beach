'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { registrarLog } from '@/lib/log'
import { ordenar, proximaOrdem, type Direcao, type Valor } from '@/lib/ordenacao'
import { buscarTudo } from '@/lib/buscar-tudo'
import { ultimosDias } from '@/lib/periodo'
import { usePagination } from '@/lib/hooks/usePagination'
import { Pagination } from '@/components/ui/pagination'
import MovimentoDialog, { type Catalogos, type MovimentoEditavel, type TipoMov } from '@/components/financeiro/MovimentoDialog'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Pencil, Trash2, Undo2 } from 'lucide-react'

type Movimentacao = MovimentoEditavel & {
  origem: string | null
  categorias_financeiro: { categoria: string; subcategoria: string | null } | null
  pessoas: { nome: string } | null
  contas_bancarias: { nome: string } | null
  bancos: { nome: string } | null
  professores: { nome: string } | null
  alunos: { nome: string } | null
  esportes: { nome: string } | null
}
type Aba = 'mov' | 'receber' | 'pagar'
type ColunaId = 'tipo' | 'categoria' | 'subcategoria' | 'esporte' | 'fornecedor' | 'pagamento' | 'vencimento' | 'valor' | 'pago' | 'meio' | 'aluno' | 'professor'

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')
const hojeIso = () => new Date().toLocaleDateString('en-CA')
const primeiroDia = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
const ultimoDia = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA') }

const feito = (m: Movimentacao) => m.status === 'Recebido' || m.status === 'Pago'
// Estornado (o Asaas devolveu o dinheiro): não conta como recebido nem como a receber
const estornado = (m: Movimentacao) => m.status === 'Estornado'
const emAberto = (m: Movimentacao) => !feito(m) && !estornado(m)
const vencimentoDe = (m: Movimentacao) => m.data_vencimento ?? m.data
const categoriaDe = (m: Movimentacao) => m.categorias_financeiro ? `${m.categorias_financeiro.categoria}${m.categorias_financeiro.subcategoria ? ' / ' + m.categorias_financeiro.subcategoria : ''}` : ''
const somar = (l: Movimentacao[]) => Math.round(l.reduce((a, m) => a + Number(m.valor), 0) * 100) / 100

const CHAVES: Record<ColunaId, (m: Movimentacao) => Valor> = {
  tipo: m => m.tipo,
  categoria: m => m.categorias_financeiro?.categoria ?? null,
  subcategoria: m => m.categorias_financeiro?.subcategoria ?? null,
  esporte: m => m.esportes?.nome ?? null,
  fornecedor: m => m.pessoas?.nome ?? null,
  pagamento: m => m.data_pagamento,
  vencimento: m => vencimentoDe(m),
  valor: m => Number(m.valor),
  pago: m => (feito(m) ? 'Sim' : 'Não'),
  meio: m => m.forma_pagamento,
  aluno: m => m.alunos?.nome ?? null,
  professor: m => m.professores?.nome ?? null,
}
const COLUNAS: { id: ColunaId; titulo: string; alinha?: 'center' | 'right' }[] = [
  { id: 'tipo', titulo: 'Tipo' },
  { id: 'categoria', titulo: 'Categoria' },
  { id: 'subcategoria', titulo: 'Subcategoria' },
  { id: 'esporte', titulo: 'Esporte' },
  { id: 'fornecedor', titulo: 'Fornecedor' },
  { id: 'pagamento', titulo: 'Pagamento' },
  { id: 'vencimento', titulo: 'Vencimento' },
  { id: 'valor', titulo: 'Valor', alinha: 'right' },
  { id: 'pago', titulo: 'Pago?', alinha: 'center' },
  { id: 'meio', titulo: 'Meio de pagamento' },
  { id: 'aluno', titulo: 'Aluno' },
  { id: 'professor', titulo: 'Professor' },
]

function Cartao({ titulo, valor, cor, nota }: { titulo: string; valor: number; cor?: string; nota?: string }) {
  return (
    <div className="bg-white border border-[#7DC421] rounded-xl px-5 py-3 flex flex-col justify-center min-h-[84px]">
      <div className="text-sm font-medium text-gray-600">{titulo}</div>
      <div className={`text-kpi ${cor ?? 'text-gray-900'}`}>{moeda(valor)}</div>
      {nota && <div className="text-xs text-gray-500">{nota}</div>}
    </div>
  )
}

export default function Financeiro() {
  const { unidadeId } = useUnidade()
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [catalogos, setCatalogos] = useState<Catalogos>({ categorias: [], pessoas: [], contas: [], bancos: [], esportes: [], alunos: [], professores: [] })
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('mov')
  const [de, setDe] = useState(primeiroDia)
  const [ate, setAte] = useState(ultimoDia)
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoMov>('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<{ coluna: ColunaId; direcao: Direcao }>({ coluna: 'vencimento', direcao: 'desc' })
  const [modal, setModal] = useState<null | { tipo: TipoMov; movimento?: Movimentacao }>(null)

  const carregar = useCallback(async () => {
    if (!unidadeId) return
    setLoading(true)
    const [m, c, p, ct, b, e, a, pr] = await Promise.all([
      buscarTudo((de, ate) => supabase.from('movimentacoes')
        .select('*, categorias_financeiro(categoria, subcategoria), pessoas(nome), contas_bancarias(nome), bancos(nome), professores(nome), alunos!movimentacoes_aluno_ref_id_fkey(nome), esportes(nome)')
        .eq('unidade_id', unidadeId).order('data_vencimento', { ascending: false }).order('id').range(de, ate)),
      supabase.from('categorias_financeiro').select('id, tipo, categoria, subcategoria').eq('ativo', true),
      supabase.from('pessoas').select('id, nome').order('nome'),
      supabase.from('contas_bancarias').select('id, nome').eq('unidade_id', unidadeId).order('nome'),
      supabase.from('bancos').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('esportes').select('id, nome').eq('ativo', true).order('nome'),
      buscarTudo((de, ate) => supabase.from('alunos').select('id, nome').eq('unidade_id', unidadeId).order('nome').order('id').range(de, ate)),
      supabase.from('professores').select('id, nome').order('nome'),
    ])
    setMovs((m.data ?? []) as unknown as Movimentacao[])
    setCatalogos({
      categorias: (c.data ?? []) as Catalogos['categorias'], pessoas: p.data ?? [], contas: ct.data ?? [], bancos: b.data ?? [],
      esportes: e.data ?? [], alunos: a.data ?? [], professores: pr.data ?? [],
    })
    setLoading(false)
  }, [unidadeId])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    // As telas antigas Contas a receber / Contas a pagar levam para cá com ?aba=
    const a = new URLSearchParams(window.location.search).get('aba')
    if (a === 'receber' || a === 'pagar') setAba(a)
  }, [])

  const hoje = hojeIso()
  const { lista, abertoTotal, vencido } = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let l = movs.filter(m => {
      if (aba === 'receber' && (m.tipo !== 'Entrada' || !emAberto(m))) return false
      if (aba === 'pagar' && (m.tipo !== 'Saída' || !emAberto(m))) return false
      if (aba === 'mov') {
        if (filtroTipo && m.tipo !== filtroTipo) return false
        const v = vencimentoDe(m)
        const noPeriodo = (v >= de && v <= ate) || (!!m.data_pagamento && m.data_pagamento >= de && m.data_pagamento <= ate)
        if (!noPeriodo) return false
      }
      if (filtroCategoria) {
        const c = categoriaDe(m).toLowerCase(), f = filtroCategoria.toLowerCase()
        if (c !== f && !c.startsWith(f + ' / ')) return false
      }
      if (q && !`${m.descricao ?? ''} ${categoriaDe(m)} ${m.esportes?.nome ?? ''} ${m.pessoas?.nome ?? ''} ${m.alunos?.nome ?? ''} ${m.professores?.nome ?? ''} ${m.contas_bancarias?.nome ?? ''} ${m.bancos?.nome ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
    // Contas a receber/pagar: o que vence primeiro fica em cima, a menos que a pessoa escolha outra coluna
    const dir: Direcao = aba !== 'mov' && ordem.coluna === 'vencimento' && ordem.direcao === 'desc' ? 'asc' : ordem.direcao
    l = ordenar(l, CHAVES[ordem.coluna], dir)
    const abertos = l.filter(emAberto)
    return { lista: l, abertoTotal: somar(abertos), vencido: somar(abertos.filter(m => vencimentoDe(m) < hoje)) }
  }, [movs, aba, de, ate, filtroTipo, filtroCategoria, busca, ordem, hoje])

  const entRecebidas = somar(lista.filter(m => m.tipo === 'Entrada' && feito(m)))
  const saiPagas = somar(lista.filter(m => m.tipo === 'Saída' && feito(m)))
  const aReceber = somar(lista.filter(m => m.tipo === 'Entrada' && emAberto(m)))
  const aPagar = somar(lista.filter(m => m.tipo === 'Saída' && emAberto(m)))

  const categoriasFiltro = useMemo(() => {
    const por = new Map<string, Set<string>>()
    for (const c of catalogos.categorias) {
      if (!por.has(c.categoria)) por.set(c.categoria, new Set())
      if (c.subcategoria) por.get(c.categoria)!.add(c.subcategoria)
    }
    return [...por.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [catalogos.categorias])

  const pagination = usePagination(lista, 20)

  async function alternarBaixa(m: Movimentacao) {
    const concluido = feito(m)
    if (!confirm(concluido ? 'Desfazer a baixa desta movimentação?' : 'Confirmar baixa desta movimentação?')) return
    const { error } = await supabase.from('movimentacoes').update({
      status: concluido ? (m.tipo === 'Entrada' ? 'Não recebido' : 'Pendente') : (m.tipo === 'Entrada' ? 'Recebido' : 'Pago'),
      data_pagamento: concluido ? null : hoje,
    }).eq('id', m.id)
    if (error) return alert('Erro ao dar baixa: ' + error.message)
    await registrarLog(concluido ? 'Baixa desfeita' : 'Baixa de movimentação', 'movimentacoes', m.id)
    carregar()
  }

  async function excluir(m: Movimentacao) {
    if (!confirm('Excluir esta movimentação? Não dá para desfazer.')) return
    const { error } = await supabase.from('movimentacoes').delete().eq('id', m.id)
    if (error) return alert('Erro ao excluir: ' + error.message)
    await registrarLog('Movimentação excluída', 'movimentacoes', m.id, m.descricao ?? undefined)
    carregar()
  }

  const abaBtn = (id: Aba, texto: string) => (
    <button onClick={() => setAba(id)}
      className={`px-4 h-10 text-sm font-medium rounded-lg transition-colors ${aba === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{texto}</button>
  )
  const campoFiltro = 'h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white'

  return (
    <div>
      <h1 className="text-page-title text-gray-900 mb-4">Financeiro</h1>

      <div className="inline-flex gap-1 p-1 mb-4 rounded-xl border border-gray-200 bg-white">
        {abaBtn('mov', 'Movimentação')}{abaBtn('receber', 'Contas a receber')}{abaBtn('pagar', 'Contas a pagar')}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        {aba === 'mov' && (
          <>
            <label><span className="text-label text-gray-500 block mb-1">De</span><input type="date" className={campoFiltro} value={de} onChange={e => setDe(e.target.value)} /></label>
            <label><span className="text-label text-gray-500 block mb-1">Até</span><input type="date" className={campoFiltro} value={ate} onChange={e => setAte(e.target.value)} /></label>
            <div>
              <span className="text-label text-gray-500 block mb-1">Consulta rápida</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                {[1, 3, 7].map((n, i) => {
                  const r = ultimosDias(hoje, n)
                  const ativo = de === r.de && ate === r.ate
                  return (
                    <button key={n} type="button" aria-pressed={ativo} onClick={() => { setDe(r.de); setAte(r.ate) }}
                      title={n === 1 ? 'Só hoje' : `Últimos ${n} dias (com hoje)`}
                      className={`h-10 px-3 text-sm whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${ativo ? 'bg-gray-900 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                      {n} {n === 1 ? 'dia' : 'dias'}
                    </button>
                  )
                })}
              </div>
            </div>
            <label><span className="text-label text-gray-500 block mb-1">Tipo</span>
              <select className={campoFiltro} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as '' | TipoMov)}>
                <option value="">Entradas e saídas</option><option value="Entrada">Só entradas</option><option value="Saída">Só saídas</option>
              </select></label>
          </>
        )}
        <label><span className="text-label text-gray-500 block mb-1">Categoria</span>
          <select className={`${campoFiltro} min-w-[14rem]`} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categoriasFiltro.map(([nome, subs]) => (
              <optgroup key={nome} label={nome}>
                <option value={nome}>Toda a categoria {nome}</option>
                {[...subs].sort().map(s => <option key={s} value={`${nome} / ${s}`}>{s}</option>)}
              </optgroup>
            ))}
          </select></label>
        <input className={`${campoFiltro} flex-1 min-w-[14rem]`} placeholder="Descrição, aluno, professor, categoria" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {aba === 'mov' ? (
          <>
            <Cartao titulo="Entradas recebidas" valor={entRecebidas} cor="text-green-600" />
            <Cartao titulo="Saídas pagas" valor={saiPagas} cor="text-red-600" />
            <Cartao titulo="Saldo do período" valor={Math.round((entRecebidas - saiPagas) * 100) / 100} cor={entRecebidas - saiPagas >= 0 ? 'text-blue-600' : 'text-red-600'} nota="recebido − pago" />
            <Cartao titulo="A receber no período" valor={aReceber} />
            <Cartao titulo="A pagar no período" valor={aPagar} />
          </>
        ) : (
          <>
            <Cartao titulo={aba === 'receber' ? 'Total a receber' : 'Total a pagar'} valor={abertoTotal} cor={aba === 'receber' ? 'text-green-600' : 'text-red-600'} nota={`${lista.length} lançamento(s) em aberto`} />
            <Cartao titulo="Vencido" valor={vencido} cor="text-red-600" />
            <Cartao titulo="A vencer" valor={Math.round((abertoTotal - vencido) * 100) / 100} cor="text-blue-600" />
          </>
        )}
      </div>

      <div className="flex gap-2 justify-end mb-2">
        <button onClick={() => setModal({ tipo: 'Entrada' })} className="h-10 min-w-[7rem] px-5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">Entrada</button>
        <button onClick={() => setModal({ tipo: 'Saída' })} className="h-10 min-w-[7rem] px-5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Saída</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap border-separate border-spacing-0">
            <thead className="[&>tr>th]:border-b [&>tr>th]:border-gray-200">
              <tr className="bg-gray-50/80">
                {COLUNAS.map(c => {
                  const ativa = ordem.coluna === c.id
                  return (
                    <th key={c.id} onClick={() => setOrdem(o => proximaOrdem(o, c.id))} title="Clique para ordenar"
                      aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`${c.alinha === 'right' ? 'text-right' : 'text-left'} px-3 h-11 text-th text-gray-600 cursor-pointer select-none hover:bg-gray-100`}>
                      <span className="inline-flex items-center gap-1">
                        {c.titulo}
                        {ativa ? (ordem.direcao === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />) : <ArrowUpDown size={12} className="text-gray-300" />}
                      </span>
                    </th>
                  )
                })}
                <th className="sticky right-0 z-20 bg-gray-50 text-center px-3 h-11 text-th text-gray-600 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">Ações</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-gray-100">
              {loading && <tr><td colSpan={13} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
              {!loading && lista.length === 0 && <tr><td colSpan={13} className="text-center py-8 text-gray-400">{aba === 'mov' ? 'Nenhum lançamento no período.' : 'Nada em aberto.'}</td></tr>}
              {pagination.paginatedItems.map(m => {
                const atrasado = emAberto(m) && vencimentoDe(m) < hoje
                return (
                  <tr key={m.id} className="group h-12 hover:bg-[#7DC421]/[0.06] transition-colors">
                    <td className="px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${m.tipo === 'Entrada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{m.tipo}</span>
                    </td>
                    <td className="px-3 text-gray-700" title={m.descricao ?? undefined}>{m.categorias_financeiro?.categoria ?? '—'}</td>
                    <td className="px-3 text-gray-700" title={m.descricao ?? undefined}>{m.categorias_financeiro?.subcategoria ?? '—'}</td>
                    <td className="px-3 text-gray-700">{m.esportes?.nome ?? '—'}</td>
                    <td className="px-3 text-gray-700">{m.pessoas?.nome ?? '—'}</td>
                    <td className="px-3 tabular-nums text-gray-700">{dataBr(m.data_pagamento)}</td>
                    <td className={`px-3 tabular-nums ${atrasado ? 'text-red-600 font-semibold' : 'text-gray-700'}`} title={atrasado ? 'Vencido' : undefined}>{dataBr(vencimentoDe(m))}</td>
                    <td className={`px-3 text-right font-semibold tabular-nums ${m.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'Saída' ? '− ' : ''}{moeda(Number(m.valor))}</td>
                    <td className="px-3 text-center">
                      <span title={estornado(m) ? 'Estornado: o valor foi devolvido' : feito(m) ? m.status ?? '' : m.tipo === 'Entrada' ? 'A receber' : 'A pagar'}
                        className={`inline-flex min-w-[3rem] justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${estornado(m) ? 'bg-gray-100 text-gray-500' : feito(m) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {estornado(m) ? 'Estornado' : feito(m) ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-3 text-gray-700">{m.forma_pagamento ?? '—'}</td>
                    <td className="px-3 text-gray-700">{m.alunos?.nome ?? '—'}</td>
                    <td className="px-3 text-gray-700">{m.professores?.nome ?? '—'}</td>
                    <td className="sticky right-0 z-10 bg-white group-hover:bg-[#f6fbee] transition-colors px-3 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => alternarBaixa(m)} title={feito(m) ? 'Desfazer baixa' : 'Dar baixa'} aria-label={feito(m) ? 'Desfazer baixa' : 'Dar baixa'}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${feito(m) ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-700' : 'text-green-600 hover:bg-green-50'}`}>
                          {feito(m) ? <Undo2 size={17} /> : <Check size={18} />}
                        </button>
                        <button onClick={() => setModal({ tipo: m.tipo, movimento: m })} title="Editar" aria-label="Editar"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Pencil size={17} /></button>
                        <button onClick={() => excluir(m)} title="Excluir" aria-label="Excluir"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={17} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} pageSize={pagination.pageSize} onPageChange={pagination.goToPage} />
      </div>
      {aba === 'mov' && <p className="mt-3 text-xs text-gray-500">O período considera o vencimento ou a data do pagamento.</p>}

      {modal && unidadeId && (
        <MovimentoDialog
          key={modal.movimento?.id ?? modal.tipo}
          tipo={modal.tipo}
          movimento={modal.movimento}
          unidadeId={unidadeId}
          catalogos={catalogos}
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar() }}
        />
      )}
    </div>
  )
}
