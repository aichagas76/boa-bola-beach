'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, CreditCard, AlertCircle, Settings, Menu, X, TrendingUp, Folder, Tags, Banknote, ChevronDown, ArrowUp, ArrowDown, LucideIcon } from 'lucide-react'

type SubItem = { href: string; label: string; icon: LucideIcon; color?: string }

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/alunos', label: 'Alunos', icon: Users },
  { href: '/pagamentos', label: 'Pagamentos', icon: CreditCard },
  { href: '/atraso', label: 'Em atraso', icon: AlertCircle },
  { href: '/financeiro', label: 'Financeiro', icon: TrendingUp },
]

const contasItems: SubItem[] = [
  { href: '/contas-receber', label: 'Contas a Receber', icon: ArrowUp, color: 'text-green-500' },
  { href: '/contas-pagar', label: 'Contas a Pagar', icon: ArrowDown, color: 'text-red-500' },
]

const cadastrosItems: SubItem[] = [
  { href: '/categorias', label: 'Categorias', icon: Tags },
  { href: '/pessoas', label: 'Fornecedores/Clientes', icon: Users },
  { href: '/contas', label: 'Contas', icon: Banknote },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [cadastrosAberto, setCadastrosAberto] = useState(false)
  const [contasAberto, setContasAberto] = useState(false)

  const cadastrosAtivo = cadastrosItems.some(item => pathname === item.href)
  const contasAtivo = contasItems.some(item => pathname === item.href)

  useEffect(() => {
    setCadastrosAberto(cadastrosAtivo)
  }, [cadastrosAtivo])

  useEffect(() => {
    setContasAberto(contasAtivo)
  }, [contasAtivo])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-[#0a0a0a] text-white p-2 rounded-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-48 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } md:relative md:translate-x-0`}
      >
        <div className="p-6 border-b border-[#1a1a1a] flex items-center justify-center">
          <img src="/BB logo.jpg" alt="Boa Bola Beach" style={{ height: '120px', width: 'auto', objectFit: 'contain' }} />
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-[#7DC421] text-white font-medium'
                    : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <Icon size={18} className={active ? '' : (item.color || '')} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setContasAberto(!contasAberto)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
              contasAtivo
                ? 'bg-[#7DC421] text-white font-medium'
                : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
            }`}
          >
            <CreditCard size={18} />
            <span>Contas</span>
            <ChevronDown size={16} className={`ml-auto transition-transform ${contasAberto ? 'rotate-180' : ''}`} />
          </button>

          {contasAberto && (
            <div className="ml-4 space-y-1 border-l border-[#1a1a1a] pl-3">
              {contasItems.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-[#7DC421] text-white font-medium'
                        : (item.color || 'text-gray-400') + ' hover:bg-[#1a1a1a] hover:text-white'
                    }`}
                  >
                    <Icon size={16} className={active ? '' : (item.color || '')} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          <button
            onClick={() => setCadastrosAberto(!cadastrosAberto)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
              cadastrosAtivo
                ? 'bg-[#7DC421] text-white font-medium'
                : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
            }`}
          >
            <Folder size={18} />
            <span>Cadastros</span>
            <ChevronDown size={16} className={`ml-auto transition-transform ${cadastrosAberto ? 'rotate-180' : ''}`} />
          </button>

          {cadastrosAberto && (
            <div className="ml-4 space-y-1 border-l border-[#1a1a1a] pl-3">
              {cadastrosItems.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-[#7DC421] text-white font-medium'
                        : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-[#1a1a1a]">
          <Link href="/configuracoes" className="flex items-center gap-3 text-xs text-gray-500 hover:text-[#7DC421] transition-colors">
            <Settings size={16} />
            <span>Configurações</span>
          </Link>
        </div>
      </aside>
    </>
  )
}