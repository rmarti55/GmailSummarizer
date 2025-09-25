'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/AppHeader'
import { Mail, BarChart3 } from 'lucide-react'

interface SenderStats {
  sender: string
  count: number
  percentage: number
}

export default function SendersPage() {
  const [senders, setSenders] = useState<SenderStats[]>([])
  const [loading, setLoading] = useState(true)

  const handleRefresh = async () => {
    // For now, just refresh sender stats
    fetchSenderStats()
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' })
      if (response.ok) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const clearAllSummaries = async () => {
    if (!confirm('Clear all existing summaries? They will be regenerated with the new adaptive system.')) return
    
    try {
      const response = await fetch('/api/clear-summaries', { method: 'POST' })
      if (response.ok) {
        alert('All summaries cleared! Visit Dashboard to refresh and generate new summaries.')
      }
    } catch (error) {
      console.error('Failed to clear summaries:', error)
    }
  }

  const clearAllEmails = async () => {
    if (!confirm('Clear all cached emails? They will be re-processed with clean formatting on next refresh.')) return
    
    try {
      const response = await fetch('/api/clear-emails', { method: 'POST' })
      if (response.ok) {
        // Clear senders data too since it depends on emails
        setSenders([])
        alert('All emails cleared! Visit Dashboard to refresh and process emails.')
      }
    } catch (error) {
      console.error('Failed to clear emails:', error)
    }
  }

  const fetchSenderStats = async () => {
    setLoading(true)
    try {
      // TODO: Implement API endpoint for sender statistics
      // const response = await fetch('/api/senders')
      // if (response.ok) {
      //   const data = await response.json()
      //   setSenders(data.senders || [])
      // }
      
      // Mock data for now
      setTimeout(() => {
        setSenders([
          { sender: 'notifications@github.com', count: 47, percentage: 23.5 },
          { sender: 'noreply@robinhood.com', count: 31, percentage: 15.5 },
          { sender: 'alerts@bankofamerica.com', count: 28, percentage: 14.0 },
          { sender: 'team@slack.com', count: 22, percentage: 11.0 },
          { sender: 'support@notion.so', count: 18, percentage: 9.0 },
        ])
        setLoading(false)
      }, 1000)
    } catch (error) {
      console.error('Failed to fetch sender stats:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSenderStats()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader
        onRefresh={handleRefresh}
        onClearSummaries={clearAllSummaries}
        onClearAllEmails={clearAllEmails}
        onLogout={handleLogout}
        loading={loading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Email Senders Overview
            </h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Ranked by email volume in your inbox
          </p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5" />
            <span>Top Senders</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : senders.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No email data found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Visit the Dashboard to fetch emails first
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {senders.map((sender, index) => (
                <div key={sender.sender} className="flex items-center justify-between py-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {sender.sender}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {sender.percentage}% of total emails
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-sm">
                      {sender.count} emails
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          💡 Click any sender to see their emails (coming soon)
        </div>
      </main>
    </div>
  )
}
