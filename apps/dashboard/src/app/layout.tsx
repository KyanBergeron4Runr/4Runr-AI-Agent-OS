import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import DemoButtons from '@/components/DemoButtons'
import ScenarioLauncher from '@/components/ScenarioLauncher'
import Tour from '@/components/Tour'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '4Runr AI Agent OS Dashboard',
  description: 'Monitor and manage AI agents with real-time insights',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="border-b bg-white">
            <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <img src="/logo.svg" alt="4Runr" className="h-6" />
                <span className="font-semibold">4Runr Agent OS</span>
                <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-gray-100">Demo</span>
              </Link>
              <div className="flex items-center gap-3">
                <ScenarioLauncher />
                <DemoButtons />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">
            {children}
          </main>
        </div>
        <Tour />
      </body>
    </html>
  )
}
