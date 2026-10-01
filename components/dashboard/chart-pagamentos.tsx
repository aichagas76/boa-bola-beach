'use client'

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartPagamentosProps {
  data: Array<{
    status: string
    valor: number
  }>
  loading?: boolean
}

const COLORS = {
  'Recebido': '#10b981',
  'Não recebido': '#f59e0b',
  'Pendente': '#ef4444',
}

export function ChartPagamentos({ data, loading }: ChartPagamentosProps) {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        Carregando...
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="valor"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[entry.status as keyof typeof COLORS] || '#8884d8'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => `R$ ${value.toFixed(2).replace('.', ',')}`}
          contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e5e5' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
