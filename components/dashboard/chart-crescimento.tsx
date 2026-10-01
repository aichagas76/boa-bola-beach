'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartCrescimentoProps {
  data: Array<{
    mes: string
    ativos: number
    inativos: number
  }>
  loading?: boolean
}

export function ChartCrescimento({ data, loading }: ChartCrescimentoProps) {
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
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="mes" />
        <YAxis />
        <Tooltip
          contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e5e5' }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="ativos"
          stroke="#10b981"
          name="Alunos Ativos"
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="inativos"
          stroke="#ef4444"
          name="Alunos Inativos"
          strokeWidth={2}
          dot={{ fill: '#ef4444', r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
