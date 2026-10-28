import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import UnidadeProvider from '@/components/layout/UnidadeProvider'
import { AvisosHost } from '@/lib/avisos-ui'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Boa Bola Beach',
  description: 'Gestão Beach Tênis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={geist.className}>
        <UnidadeProvider>
        <div className="flex">
          <Sidebar />
          <main className="w-full md:flex-1 min-w-0 min-h-screen bg-[#F5F5F5] p-4 md:p-4">
            {children}
          </main>
        </div>
        </UnidadeProvider>
        <AvisosHost />
      </body>
    </html>
  )
}