'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscar-tudo'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import { itensFinanceiros, listaInadimplentes, type MatP, type MovP, type PagP } from '@/lib/painel'

type LinhaAluno = { id: string; nome: string; status: string | null; data_vencimento: string | null; unidade_id: string | null }
type LinhaMat = MatP & { unidade_id: string | null; acesso_duas_unidades: boolean | null }

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

const FAIXAS = [
  { id: 'todas', nome: 'Todas', ok: () => true },
  { id: '7', nome: 'Até 7 dias', ok: (d: number) => d <= 7 },
  { id: '30', nome: '8 a 30 dias', ok: (d: number) => d > 7 && d <= 30 },
  { id: '30+', nome: 'Mais de 30 dias', ok: (d: number) => d > 30 },
]

/** Alunos ativos em atraso: a mesma conta do indicador "Inadimplência" do Painel. */
export default function AtrasoPage() {
  const { unidadeId } = useUnidade()
  const hoje = useMemo(() => new Date().toLocaleDateString('en-CA'), [])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [alunos, setAlunos] = useState<LinhaAluno[]>([])
  const [mats, setMats] = useState<LinhaMat[]>([])
  const [movs, setMovs] = useState<MovP[]>([])
  const [pags, setPags] = useState<PagP[]>([])
  const [faixa, setFaixa] = useState('todas')

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setLoading(true)
      setErro(false)
      const [ra, rm, rf, rp] = await Promise.all([
        buscarTudo((de, ate) => supabase.from('alunos').select('id, nome, status, data_vencimento, unidade_id').eq('status', 'Ativo').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('matriculas').select('aluno_id, tipo, valor, unidade_id, acesso_duas_unidades').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('movimentacoes').select('tipo, status, valor, data, data_pagamento, data_vencimento, aluno_ref_id')
          .eq('unidade_id', unidadeId).eq('tipo', 'Entrada').not('aluno_ref_id', 'is', null).neq('status', 'Recebido').order('id').range(de, ate)),
        buscarTudo((de, ate) => supabase.from('pagamentos').select('aluno_id, valor, status, data_vencimento').neq('status', 'Pago').order('id').range(de, ate)),
      ])
      if (cancelado) return
      if (ra.error || rm.error || rf.error || rp.error) {
        setErro(true)
        setLoading(false)
        return
      }
      setAlunos((ra.data ?? []) as unknown as LinhaAluno[])
      setMats((rm.data ?? []) as unknown as LinhaMat[])
      setMovs((rf.data ?? []) as unknown as MovP[])
      setPags((rp.data ?? []) as PagP[])
      setLoading(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId])

  const lista = useMemo(() => {
    // Aluno da unidade: é dela ou tem matrícula nela / em combo (igual ao Painel)
    const matsU = mats.filter(m => !unidadeId || m.unidade_id === unidadeId || m.acesso_duas_unidades)
    const comMatricula = new Set(matsU.map(m => m.aluno_id))
    const alunosU = alunos.filter(a => !unidadeId || a.unidade_id === unidadeId || comMatricula.has(a.id))
    const ids = new Set(alunosU.map(a => a.id))
    const movsP = movs.map(m => ({ ...m, valor: Number(m.valor) }))
    const itens = itensFinanceiros(movsP, pags.filter(p => p.aluno_id && ids.has(p.aluno_id)))
    return listaInadimplentes({ alunos: alunosU, mats: matsU.filter(m => ids.has(m.aluno_id)), itens, hoje })
  }, [alunos, mats, movs, pags, unidadeId, hoje])

  const f = FAIXAS.find(x => x.id === faixa) ?? FAIXAS[0]
  const filtrados = lista.filter(l => f.ok(l.dias))
  const total = filtrados.reduce((s, l) => s + l.valor, 0)

  return (
    <div>
      <div className="mb-4 pl-12 md:pl-0">
        <h1 className="text-page-title text-gray-900">Alunos em atraso</h1>
        <p className="text-sm text-gray-500">Alunos ativos com cobrança vencida em aberto ou com o vencimento do cadastro já passado. É a mesma conta do indicador de inadimplência do Painel.</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex max-w-[calc(100vw-2rem)] overflow-x-auto rounded-lg border border-gray-200 bg-white" role="group" aria-label="Faixa de atraso">
          {FAIXAS.map(x => (
            <button key={x.id} type="button" aria-pressed={faixa === x.id} onClick={() => setFaixa(x.id)}
              className={`px-3 h-9 text-sm font-medium whitespace-nowrap transition-colors ${faixa === x.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{x.nome}</button>
          ))}
        </div>
        {!loading && !erro && <span className="text-sm text-gray-600"><strong className="text-gray-900">{filtrados.length}</strong> {filtrados.length === 1 ? 'aluno' : 'alunos'} · {brl(total)}</span>}
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não consegui carregar a lista. Atualize a página; se continuar, avise o suporte.</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-th text-gray-500">Aluno</th>
              <th className="text-left px-4 py-3 text-th text-gray-500">Vencimento</th>
              <th className="text-right px-4 py-3 text-th text-gray-500">Dias em atraso</th>
              <th className="text-right px-4 py-3 text-th text-gray-500">Valor</th>
              <th className="text-left px-4 py-3 text-th text-gray-500">Origem</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
            {!loading && !erro && filtrados.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum aluno em atraso.</td></tr>}
            {filtrados.map(l => (
              <tr key={l.alunoId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/alunos/${l.alunoId}`} className="hover:text-blue-700 hover:underline">{l.nome}</Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{dataBR(l.vencimento)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${l.dias > 30 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>{l.dias}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-800">{l.valor > 0 ? brl(l.valor) : '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {l.origem === 'cobranca' ? `${l.qtdCobrancas} ${l.qtdCobrancas === 1 ? 'cobrança vencida' : 'cobranças vencidas'}` : 'Vencimento do cadastro (mensalidade)'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
