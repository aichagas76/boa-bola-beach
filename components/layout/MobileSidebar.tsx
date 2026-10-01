'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'

export function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const links = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/alunos', label: 'Alunos', icon: '👥' },
    { href: '/pagamentos', label: 'Pagamentos', icon: '💰' },
    { href: '/atraso', label: 'Em atraso', icon: '⚠️' },
    { href: '/financeiro', label: 'Financeiro', icon: '📈' },
    { href: '/logs', label: 'Logs', icon: '📋' },
  ]

  const handleLogout = async () => {
    const { createClientComponentClient } = await import('@supabase/auth-helpers-nextjs')
    const supabase = createClientComponentClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4 h-16">
        <div className="flex items-center gap-2">
          <img src="/BB logo.jpg" alt="Boa Bola" className="h-8 w-8 rounded" />
          <span className="font-semibold text-gray-900">Boa Bola</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setIsOpen(false)} />
      )}

      <div
        className={`md:hidden fixed left-0 top-0 bottom-0 w-64 bg-black text-white z-40 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } pt-20 overflow-y-auto`}
      >
        <nav className="flex flex-col space-y-2 p-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-base"
            >
              <span className="text-xl">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-700 mt-4 pt-4 px-4">
          <button
            onClick={() => {
              setIsOpen(false)
              handleLogout()
            }}
            className="w-full px-4 py-3 text-red-400 hover:bg-gray-800 rounded-lg transition-colors text-base"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="md:hidden h-16" />
    </>
  )
}
