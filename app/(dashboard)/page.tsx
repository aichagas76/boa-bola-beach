'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ChartReceita } from '@/components/dashboard/chart-receita'
import { ChartPagamentos } from '@/components/dashboard/chart-pagamentos'
import { ChartCrescimento } from '@/components/dashboard/chart-crescimento'

export default function Dashboard() {
  const [totalAtivos, setTotalAtivos] = useState(0)
  const [totalInativos, setTotalInativos] = useState(0)
  const [receitaMensal, setReceitaMensal] = useState(0)
  const [totalAtrasados, setTotalAtrasados] = useState(0)
  const [chartReceitaData, setChartReceitaData] = useState<Array<{ modalidade: string; valor: number }>>([])
  const [chartPagamentosData, setChartPagamentosData] = useState<Array<{ status: string; valor: number }>>([])
  const [chartCrescimentoData, setChartCrescimentoData] = useState<Array<{ mes: string; ativos: number; inativos: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: alunos } = await supabase
        .from('alunos')
        .select('id, status, data_cadastro')

      const { data: matriculas } = await supabase
        .from('matriculas')
        .select('aluno_id, tipo, valor')

      const { data: movimentacoes } = await supabase
        .from('movimentacoes')
        .select('status, valor, tipo')

      const ativos = (alunos ?? []).filter(a => a.status === 'Ativo')
      const inativos = (alunos ?? []).filter(a => a.status === 'Inativo')
      const idsAtivos = new Set(ativos.map(a => a.id))

      const receita = (matriculas ?? [])
        .filter(m => idsAtivos.has(m.aluno_id))
        .reduce((acc, m) => acc + (m.valor ?? 0), 0)

      const atrasados = (movimentacoes ?? []).filter(p => p.status === 'Não recebido' || p.status === 'Pendente').length

      // Dados para gráfico de receita por modalidade
      const receitaPorModalidade = (matriculas ?? [])
        .filter(m => idsAtivos.has(m.aluno_id))
        .reduce((acc: Record<string, number>, m) => {
          const tipo = m.tipo || 'Outro'
          acc[tipo] = (acc[tipo] || 0) + (m.valor ?? 0)
          return acc
        }, {})

      const chartReceitaArray = Object.entries(receitaPorModalidade).map(([modalidade, valor]) => ({
        modalidade,
        valor: typeof valor === 'number' ? valor : 0,
      }))

      // Dados para gráfico de status de pagamentos
      const pagamentosPorStatus = (movimentacoes ?? []).reduce((acc: Record<string, number>, m) => {
        const status = m.status || 'Desconhecido'
        acc[status] = (acc[status] || 0) + (m.valor ?? 0)
        return acc
      }, {})

      const chartPagamentosArray = Object.entries(pagamentosPorStatus).map(([status, valor]) => ({
        status,
        valor: typeof valor === 'number' ? valor : 0,
      }))

      // Dados para gráfico de crescimento (últimos 6 meses)
      const agora = new Date()
      const meses: Record<string, { ativos: number; inativos: number }> = {}

      for (let i = 5; i >= 0; i--) {
        const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
        const chave = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        meses[chave] = { ativos: 0, inativos: 0 }
      }

      ;(alunos ?? []).forEach(a => {
        if (!a.data_cadastro) return
        const data = new Date(a.data_cadastro + 'T00:00:00')
        if (data <= agora) {
          const chave = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
          for (const mesChave in meses) {
            if (new Date(mesChave) >= data) {
              if (a.status === 'Ativo') meses[mesChave].ativos++
              else meses[mesChave].inativos++
            }
          }
        }
      })

      const chartCrescimentoArray = Object.entries(meses).map(([mes, valores]) => ({
        mes,
        ativos: valores.ativos,
        inativos: valores.inativos,
      }))

      setTotalAtivos(ativos.length)
      setTotalInativos(inativos.length)
      setReceitaMensal(receita)
      setTotalAtrasados(atrasados)
      setChartReceitaData(chartReceitaArray)
      setChartPagamentosData(chartPagamentosArray)
      setChartCrescimentoData(chartCrescimentoArray)
      setLoading(false)
    }
    carregar()
  }, [])

  const cards = [
    {
      label: 'Alunos ativos',
      value: loading ? '...' : totalAtivos,
      sub: `${totalInativos} inativos`,
      icon: '👥',
      href: '/alunos',
    },
    {
      label: 'Receita mensal',
      value: loading ? '...' : `R$ ${receitaMensal.toFixed(2).replace('.', ',')}`,
      sub: 'soma das mensalidades ativas',
      icon: '💰',
      href: '/pagamentos',
    },
    {
      label: 'Em atraso',
      value: loading ? '...' : totalAtrasados,
      sub: 'cobranças em atraso',
      icon: '⚠️',
      href: '/pagamentos',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map(card => (
          <Link key={card.label} href={card.href}>
            <div className="bg-white border border-[#7DC421] rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-1">{card.label}</div>
                  <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                </div>
                <div className="text-4xl opacity-60 group-hover:opacity-100 transition-opacity">{card.icon}</div>
              </div>
              <div className="text-xs text-gray-500">{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Receita por Modalidade</div>
          <ChartReceita data={chartReceitaData} loading={loading} />
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Status de Pagamentos</div>
          <ChartPagamentos data={chartPagamentosData} loading={loading} />
        </div>
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-xl p-6 mb-8">
        <div className="text-sm font-semibold text-gray-900 mb-4">Crescimento de Alunos (Últimos 6 Meses)</div>
        <ChartCrescimento data={chartCrescimentoData} loading={loading} />
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-xl p-6">
        <div className="text-sm font-semibold text-gray-900 mb-4">Acesso rápido</div>
        <div className="flex gap-3">
          <Link href="/alunos/novo" className="px-4 py-2.5 text-sm bg-[#7DC421] text-white font-medium rounded-lg hover:bg-[#6ab01a] transition-colors">
            + Novo aluno
          </Link>
          <Link href="/alunos" className="px-4 py-2.5 text-sm border border-[#e5e5e5] rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Ver alunos
          </Link>
          <Link href="/pagamentos" className="px-4 py-2.5 text-sm border border-[#e5e5e5] rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Ver pagamentos
          </Link>
        </div>
      </div>
    </div>
  )
}