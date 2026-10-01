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
  const [sortConfig, setSortConfig] = useState<{ column: 'nome' | 'data_vencimento' | 'valor_total', direction: 'asc' | 'desc' }>({ column: 'nome', direction: 'asc' })

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

  const filtrados = sortAlunos(alunos.filter(a => {
    const matchBusca = a.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      a.cpf?.includes(busca) ||
      a.celular?.includes(busca)
    const matchFiltro = filtro === 'Todos' || a.status === filtro
    return matchBusca && matchFiltro
  }))

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

  function formatarWhatsApp(celular: string) {
    const numeros = celular.replace(/\D/g, '')
    return `55${numeros}`
  }

  function mascaraCelular(v: string) {
    v = v.replace(/\D/g, '').slice(0, 11)
    if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
    return v
  }

  function handleSort(column: 'nome' | 'data_vencimento' | 'valor_total') {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  function sortAlunos(lista: Aluno[]) {
    return [...lista].sort((a, b) => {
      let aVal: any = a[sortConfig.column]
      let bVal: any = b[sortConfig.column]

      if (sortConfig.column === 'nome') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
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

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th
                onClick={() => handleSort('nome')}
                className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Nome {sortConfig.column === 'nome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Celular</th>
              <th
                onClick={() => handleSort('data_vencimento')}
                className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Vencimento {sortConfig.column === 'data_vencimento' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Modalidade</th>
              <th
                onClick={() => handleSort('valor_total')}
                className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Valor {sortConfig.column === 'valor_total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
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
                <td className="px-4 py-3 text-gray-600">
                  <a href={`https://wa.me/55${aluno.celular.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {mascaraCelular(aluno.celular)}
                  </a>
                </td>
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