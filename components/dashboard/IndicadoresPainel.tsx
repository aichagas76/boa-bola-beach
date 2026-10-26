'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/components/layout/UnidadeProvider'
import {
  alunosPorModalidade, faturamentoPorProfessor, resumoPorMes, totaisDoPeriodo, ultimosMeses,
  type AlunoSimples, type MatriculaSimples, type Mov,
} from '@/lib/relatorios'

const COR_ESPORTE: Record<string, string> = {
  'Beach Tênis': '#F97316',
  'Tênis': '#84A60F',
  Padel: '#2563EB',
  Pickleball: '#EAB308',
  'Sem esporte': '#9CA3AF',
}
const corDoEsporte = (nome: string) => COR_ESPORTE[nome] ?? '#6B7280'

const PERIODOS = [
  { meses: 1, nome: 'Este mês' },
  { meses: 3, nome: '3 meses' },
  { meses: 6, nome: '6 meses' },
  { meses: 12, nome: '12 meses' },
]

const reais = (v: unknown) => `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const reaisCurto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))

function Cartao({ titulo, children, vazio }: { titulo: string; children: React.ReactNode; vazio?: boolean }) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-5">
      <div className="text-sm font-semibold text-gray-900 mb-4">{titulo}</div>
      {vazio ? <div className="h-64 flex items-center justify-center text-sm text-gray-400">Sem dados neste período</div> : children}
    </div>
  )
}

function Indicador({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-5">
      <div className="text-sm font-medium text-gray-600 mb-1">{rotulo}</div>
      <div className={`text-kpi ${cor}`}>{reais(valor)}</div>
    </div>
  )
}

type LinhaMov = {
  tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null
  professor_id: string | null; professores: { nome: string } | null; esportes: { nome: string } | null
}
type LinhaMatricula = {
  aluno_id: string; tipo: string; unidade_id: string | null; acesso_duas_unidades: boolean | null; esportes: { nome: string } | null
}

/** Indicadores do Painel: alunos por modalidade, faturamento bruto, lucro líquido e faturamento por professor (por esporte). */
export default function IndicadoresPainel() {
  const { unidadeId } = useUnidade()
  const [meses, setMeses] = useState(6)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [alunos, setAlunos] = useState<AlunoSimples[]>([])
  const [matriculas, setMatriculas] = useState<MatriculaSimples[]>([])
  const [movs, setMovs] = useState<Mov[]>([])

  const hoje = new Date().toLocaleDateString('en-CA')
  const listaMeses = useMemo(() => ultimosMeses(hoje, meses), [hoje, meses])

  useEffect(() => {
    if (!unidadeId) return
    let cancelado = false
    async function carregar() {
      setLoading(true)
      setErro(null)
      const inicio = `${listaMeses[0]}-01`
      const [a, m, f] = await Promise.all([
        supabase.from('alunos').select('id, status'),
        supabase.from('matriculas').select('aluno_id, tipo, unidade_id, acesso_duas_unidades, esportes(nome)'),
        supabase
          .from('movimentacoes')
          .select('tipo, status, valor, data, data_pagamento, professor_id, professores(nome), esportes(nome)')
          .eq('unidade_id', unidadeId)
          .or(`data.gte.${inicio},data_pagamento.gte.${inicio}`)
          .limit(5000),
      ])
      if (cancelado) return
      if (a.error || m.error || f.error) {
        setErro('Não consegui carregar os indicadores. Se a mensagem persistir, avise o suporte.')
        setLoading(false)
        return
      }
      setAlunos((a.data ?? []) as AlunoSimples[])
      setMatriculas(((m.data ?? []) as unknown as LinhaMatricula[]).map(x => ({
        aluno_id: x.aluno_id, tipo: x.tipo, unidade_id: x.unidade_id, acesso_duas_unidades: x.acesso_duas_unidades, esporte_nome: x.esportes?.nome ?? null,
      })))
      setMovs(((f.data ?? []) as unknown as LinhaMov[]).map(x => ({
        tipo: x.tipo, status: x.status, valor: Number(x.valor), data: x.data, data_pagamento: x.data_pagamento,
        professor_id: x.professor_id, professor_nome: x.professores?.nome ?? null, esporte_nome: x.esportes?.nome ?? null,
      })))
      setLoading(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [unidadeId, listaMeses])

  const porMes = useMemo(() => resumoPorMes(movs, listaMeses), [movs, listaMeses])
  const totais = useMemo(() => totaisDoPeriodo(porMes), [porMes])
  const porProfessor = useMemo(() => faturamentoPorProfessor(movs, listaMeses), [movs, listaMeses])
  const porModalidade = useMemo(() => alunosPorModalidade(alunos, matriculas, unidadeId), [alunos, matriculas, unidadeId])

  return (
    <GraficosPainel
      meses={meses} onMeses={setMeses} loading={loading} erro={erro}
      totais={totais} porMes={porMes} porProfessor={porProfessor} porModalidade={porModalidade}
    />
  )
}

type GraficosProps = {
  meses: number
  onMeses: (n: number) => void
  loading: boolean
  erro: string | null
  totais: ReturnType<typeof totaisDoPeriodo>
  porMes: ReturnType<typeof resumoPorMes>
  porProfessor: ReturnType<typeof faturamentoPorProfessor>
  porModalidade: ReturnType<typeof alunosPorModalidade>
}

/** Só o desenho dos indicadores (recebe os números prontos). */
export function GraficosPainel({ meses, onMeses, loading, erro, totais, porMes, porProfessor, porModalidade }: GraficosProps) {
  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-section-title text-gray-900">Indicadores</h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {PERIODOS.map(p => (
            <button key={p.meses} type="button" onClick={() => onMeses(p.meses)}
              className={`px-3 h-9 text-sm font-medium transition-colors ${meses === p.meses ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Indicador rotulo="Faturamento bruto" valor={loading ? 0 : totais.bruto} cor="text-gray-900" />
        <Indicador rotulo="Despesas pagas" valor={loading ? 0 : totais.despesas} cor="text-red-600" />
        <Indicador rotulo="Lucro líquido" valor={loading ? 0 : totais.lucro} cor={totais.lucro < 0 ? 'text-red-600' : 'text-green-700'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cartao titulo="Alunos por modalidade (por esporte)" vazio={!loading && porModalidade.dados.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porModalidade.dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="modalidade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {porModalidade.esportes.map(e => <Bar key={e} dataKey={e} stackId="a" fill={corDoEsporte(e)} name={e} />)}
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo="Faturamento bruto por mês" vazio={!loading && totais.bruto === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="rotulo" />
              <YAxis tickFormatter={reaisCurto} />
              <Tooltip formatter={reais} />
              <Bar dataKey="bruto" name="Faturamento bruto" fill="#7DC421" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo="Lucro líquido por mês (entradas − despesas)" vazio={!loading && totais.bruto === 0 && totais.despesas === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="rotulo" />
              <YAxis tickFormatter={reaisCurto} />
              <Tooltip formatter={reais} />
              <Bar dataKey="lucro" name="Lucro líquido" radius={[6, 6, 0, 0]}>
                {porMes.map(l => <Cell key={l.mes} fill={l.lucro < 0 ? '#EF4444' : '#16A34A'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo="Faturamento por professor (por esporte)" vazio={!loading && porProfessor.dados.length === 0}>
          <ResponsiveContainer width="100%" height={Math.max(260, porProfessor.dados.length * 44 + 70)}>
            <BarChart data={porProfessor.dados} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tickFormatter={reaisCurto} />
              <YAxis type="category" dataKey="professor" width={90} />
              <Tooltip formatter={reais} />
              <Legend />
              {porProfessor.esportes.map(e => <Bar key={e} dataKey={e} stackId="p" fill={corDoEsporte(e)} name={e} />)}
            </BarChart>
          </ResponsiveContainer>
        </Cartao>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Faturamento = entradas já recebidas (pela data do pagamento). Despesas = saídas já pagas. Os valores são da unidade escolhida no menu.
      </p>
    </section>
  )

}
