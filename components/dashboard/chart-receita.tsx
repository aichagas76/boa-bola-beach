'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartReceitaProps {
  data: Array<{
    modalidade: string
    valor: number
  }>
  loading?: boolean
}

export function ChartReceita({ data, loading }: ChartReceitaProps) {
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
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="modalidade" />
        <YAxis />
        <Tooltip
          formatter={(value) => `R$ ${value.toFixed(2).replace('.', ',')}`}
          contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e5e5' }}
        />
        <Legend />
        <Bar dataKey="valor" fill="#7DC421" name="Receita" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
