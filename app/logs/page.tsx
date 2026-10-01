'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type Log = {
  id: string
  usuario_email: string
  acao: string
  tabela: string | null
  registro_id: string | null
  detalhes: string | null
  created_at: string
}

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')

  useEffect(() => {
    supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setLogs(data ?? [])
        setLoading(false)
      })
  }, [])

  const usuarios = useMemo(() => [...new Set(logs.map(l => l.usuario_email))].filter(Boolean), [logs])
  const acoes = useMemo(() => [...new Set(logs.map(l => l.acao))].filter(Boolean), [logs])

  const filtrados = logs.filter(l => {
    const matchUsuario = !filtroUsuario || l.usuario_email === filtroUsuario
    const matchAcao = !filtroAcao || l.acao === filtroAcao
    return matchUsuario && matchAcao
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-gray-900">Logs de ações</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Usuário</label>
          <select
            value={filtroUsuario}
            onChange={e => setFiltroUsuario(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos</option>
            {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Ação</label>
          <select
            value={filtroAcao}
            onChange={e => setFiltroAcao(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todas</option>
            {acoes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Data/Hora</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ação</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tabela</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum log encontrado.</td></tr>
            )}
            {filtrados.map((log, i) => (
              <tr key={log.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === filtrados.length - 1 ? 'border-0' : ''}`}>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{log.usuario_email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {log.acao}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{log.tabela ?? '-'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{log.detalhes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
