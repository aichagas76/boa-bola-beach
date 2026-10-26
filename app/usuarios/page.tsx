'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

type Unidade = { id: string; codigo: string; nome: string }
type Usuario = { id: string; email: string; ultimoLogin: string | null; administrador: boolean; unidadeIds: string[] }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [eu, setEu] = useState('')
  const [loading, setLoading] = useState(true)
  const [semPermissao, setSemPermissao] = useState(false)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [novasUnidades, setNovasUnidades] = useState<string[]>([])
  const [criando, setCriando] = useState(false)

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    if (res.status === 403) {
      setSemPermissao(true)
      setLoading(false)
      return
    }
    const data = await res.json()
    setUsuarios(data.usuarios ?? [])
    setUnidades(data.unidades ?? [])
    setEu(data.eu ?? '')
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function alternarUnidade(u: Usuario, unidadeId: string) {
    const novas = u.unidadeIds.includes(unidadeId) ? u.unidadeIds.filter(x => x !== unidadeId) : [...u.unidadeIds, unidadeId]
    if (novas.length === 0) return alert('O usuário precisa ter pelo menos uma unidade.')
    setSalvandoId(u.id)
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'acessos', userId: u.id, unidadeIds: novas }),
    })
    const data = await res.json()
    setSalvandoId(null)
    if (!res.ok) return alert(data.error ?? 'Não consegui salvar.')
    setUsuarios(lista => lista.map(x => (x.id === u.id ? { ...x, unidadeIds: novas } : x)))
  }

  async function criar() {
    setCriando(true)
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'criar', email, senha, unidadeIds: novasUnidades }),
    })
    const data = await res.json()
    setCriando(false)
    if (!res.ok) return alert(data.error ?? 'Não consegui criar o login.')
    setEmail('')
    setSenha('')
    setNovasUnidades([])
    carregar()
  }

  if (loading) return <div className="text-gray-400 text-sm">Carregando...</div>
  if (semPermissao) return <div className="text-sm text-gray-600">Só o administrador pode gerenciar os usuários.</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-page-title text-gray-900 mb-2">Usuários</h1>
      <p className="text-sm text-gray-500 mb-6">
        Cada login só enxerga os alunos e o financeiro das unidades marcadas para ele.
      </p>

      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-section-title text-gray-900 mb-3">Novo usuário</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-700 block mb-1">E-mail (será o login)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@exemplo.com"
              className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm" autoComplete="off" />
          </div>
          <div>
            <label className="text-sm text-gray-700 block mb-1">Senha (mínimo 8 caracteres)</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Digite a senha"
              className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm" autoComplete="new-password" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-sm text-gray-700 mb-1">Unidades que este login pode ver</div>
          <div className="flex flex-wrap gap-4">
            {unidades.map(un => (
              <label key={un.id} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={novasUnidades.includes(un.id)}
                  onChange={e => setNovasUnidades(e.target.checked ? [...novasUnidades, un.id] : novasUnidades.filter(x => x !== un.id))} />
                {un.nome}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={criar} disabled={criando} className="h-10 px-5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {criando ? 'Criando...' : 'Criar usuário'}
          </button>
        </div>
      </section>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-th text-gray-500">Login</th>
              {unidades.map(un => <th key={un.id} className="text-center px-4 py-3 text-th text-gray-500">{un.nome}</th>)}
              <th className="text-left px-4 py-3 text-th text-gray-500">Último acesso</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">
                  {u.email}
                  {u.administrador && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"><ShieldCheck size={12} /> Administrador</span>
                  )}
                  {u.id === eu && <span className="ml-2 text-xs text-gray-400">(você)</span>}
                </td>
                {unidades.map(un => (
                  <td key={un.id} className="px-4 py-3 text-center">
                    <input type="checkbox" className="h-[18px] w-[18px] accent-blue-600" checked={u.unidadeIds.includes(un.id)}
                      disabled={salvandoId === u.id} onChange={() => alternarUnidade(u, un.id)} />
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-500">{u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('pt-BR') : 'Nunca entrou'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
