'use client'

import { Badge } from '@/components/ui/badge'
import { AccountDropdown } from '@/components/AccountDropdown'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AppHeaderProps {
  onRefresh: () => void
  onClearSummaries: () => void
  onClearAllEmails: () => void
  onLogout: () => void
  loading?: boolean
}

export function AppHeader({ 
  onRefresh, 
  onClearSummaries, 
  onClearAllEmails, 
  onLogout,
  loading = false 
}: AppHeaderProps) {
  const pathname = usePathname()
  
  const isActive = (path: string) => pathname === path

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Gmail Summarizer
              </h1>
              <Badge variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                GPT-OSS-120B
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <nav className="flex items-center space-x-6">
              <Link 
                href="/dashboard" 
                className={`text-sm font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                    : 'text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                href="/senders" 
                className={`text-sm font-medium transition-colors ${
                  isActive('/senders')
                    ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                    : 'text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Senders
              </Link>
            </nav>
            
            <AccountDropdown
              onRefresh={onRefresh}
              onClearSummaries={onClearSummaries}
              onClearAllEmails={onClearAllEmails}
              onLogout={onLogout}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
