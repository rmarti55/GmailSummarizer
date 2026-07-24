'use client'

import { Badge } from '@/components/ui/badge'
import { AccountDropdown } from '@/components/AccountDropdown'
import { EmailStatsBar } from '@/components/EmailStatsBar'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AppHeaderProps {
  onRefresh: () => void
  onClearSummaries: () => void
  onClearAllEmails: () => void
  onLogout: () => void
  onFullSync?: (silent?: boolean) => void
  loading?: boolean
}

export function AppHeader({ 
  onRefresh, 
  onClearSummaries, 
  onClearAllEmails, 
  onLogout,
  onFullSync,
  loading = false 
}: AppHeaderProps) {
  const pathname = usePathname()
  
  const isActive = (path: string) => pathname === path

  return (
    <>
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-semibold text-foreground">
                  Gmail Summarizer
                </h1>
                <Badge variant="secondary" className="text-xs">
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
                      ? 'text-primary hover:text-primary/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Dashboard
                </Link>
                <Link 
                  href="/senders" 
                  className={`text-sm font-medium transition-colors ${
                    isActive('/senders')
                      ? 'text-primary hover:text-primary/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Senders
                </Link>
                <Link 
                  href="/intelligence" 
                  className={`text-sm font-medium transition-colors ${
                    isActive('/intelligence')
                      ? 'text-primary hover:text-primary/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Intelligence
                </Link>
                <Link 
                  href="/insights" 
                  className={`text-sm font-medium transition-colors ${
                    isActive('/insights')
                      ? 'text-primary hover:text-primary/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Insights
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
      
      {/* Email Stats Bar - only show on Dashboard */}
      {isActive('/dashboard') && onFullSync && (
        <EmailStatsBar onFullSync={onFullSync} />
      )}
    </>
  )
}
