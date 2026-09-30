import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

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
        <div className="flex">
          <Sidebar />
          <main className="ml-48 flex-1 min-h-screen bg-[#F5F5F5] p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}