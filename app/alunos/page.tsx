'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Aluno = {
  id: string
  nome: string
  celular: string
  cpf: string
  status: string
  data_vencimento: string
  valor_total: number
  modalidades: string[]
}

export default function Alunos() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)

    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome, celular, cpf, status, data_vencimento')
      .order('nome')

    const { data: matriculasData } = await supabase
      .from('matriculas')
      .select('aluno_id, tipo, valor')

    const alunos = (alunosData ?? []).map(a => {
      const mats = (matriculasData ?? []).filter(m => m.aluno_id === a.id)
      const valor_total = mats.reduce((acc, m) => acc + (m.valor ?? 0), 0)
      const modalidades = mats.map(m => m.tipo)
      return { ...a, valor_total, modalidades }
    })

    setAlunos(alunos)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const filtrados = alunos.filter(a => {
    const matchBusca = a.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      a.cpf?.includes(busca) ||
      a.celular?.includes(busca)
    const matchFiltro = filtro === 'Todos' || a.status === filtro
    return matchBusca && matchFiltro
  })

  const contadores = {
    Todos: alunos.length,
    Ativo: alunos.filter(a => a.status === 'Ativo').length,
    Inativo: alunos.filter(a => a.status === 'Inativo').length,
  }

  function iconeModalidade(modalidades: string[]) {
    const temClubinho = modalidades.includes('Clubinho')
    const temAula = modalidades.includes('Aula')
    if (temClubinho && temAula) return '🏆🎓'
    if (temClubinho) return '🏆'
    if (temAula) return '🎓'
    return '-'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-gray-900">Alunos</h1>
        <Link
          href="/alunos/novo"
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Novo aluno
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou celular..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {(['Todos', 'Ativo', 'Inativo'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtro === f
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f} ({contadores[f as keyof typeof contadores] ?? alunos.length})
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Celular</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Modalidade</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhum aluno encontrado.</td></tr>
            )}
            {filtrados.map((aluno, i) => (
              <tr key={aluno.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === filtrados.length - 1 ? 'border-0' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{aluno.nome}</td>
                <td className="px-4 py-3 text-gray-600">{aluno.celular}</td>
                <td className="px-4 py-3 text-gray-600">
                  {aluno.data_vencimento ? new Date(aluno.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-3 text-lg">{iconeModalidade(aluno.modalidades)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {aluno.valor_total > 0 ? `R$ ${aluno.valor_total.toFixed(2).replace('.', ',')}` : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    aluno.status === 'Ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {aluno.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/alunos/${aluno.id}`} className="text-xs text-blue-600 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}