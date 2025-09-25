'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/AppHeader'
import { ExpandableSenderCard } from '@/components/ExpandableSenderCard'
import { Mail, BarChart3 } from 'lucide-react'
import { SenderStats, PaginationInfo, Email } from '@/types'

export default function SendersPage() {
  const [senders, setSenders] = useState<SenderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSender, setExpandedSender] = useState<string | null>(null)
  const [senderEmails, setSenderEmails] = useState<Record<string, Email[]>>({})
  const [senderPagination, setSenderPagination] = useState<Record<string, PaginationInfo>>({})
  const [senderLoading, setSenderLoading] = useState<Record<string, boolean>>({})

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
      const response = await fetch('/api/senders')
      if (response.ok) {
        const data = await response.json()
        setSenders(data.senders || [])
      } else {
        console.error('Failed to fetch sender stats')
      }
    } catch (error) {
      console.error('Failed to fetch sender stats:', error)
    }
    setLoading(false)
  }

  const fetchSenderEmails = async (sender: string, page: number = 1) => {
    setSenderLoading(prev => ({ ...prev, [sender]: true }))
    try {
      const response = await fetch(`/api/senders/${encodeURIComponent(sender)}/emails?page=${page}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setSenderEmails(prev => ({ ...prev, [sender]: data.emails || [] }))
        setSenderPagination(prev => ({ ...prev, [sender]: data.pagination }))
      } else {
        console.error('Failed to fetch sender emails')
      }
    } catch (error) {
      console.error('Failed to fetch sender emails:', error)
    }
    setSenderLoading(prev => ({ ...prev, [sender]: false }))
  }

  const handleToggleExpand = async (sender: string) => {
    if (expandedSender === sender) {
      // Collapse
      setExpandedSender(null)
    } else {
      // Expand
      setExpandedSender(sender)
      if (!senderEmails[sender]) {
        await fetchSenderEmails(sender, 1)
      }
    }
  }

  const handlePageChange = async (sender: string, page: number) => {
    await fetchSenderEmails(sender, page)
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

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : senders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No email data found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Visit the Dashboard to fetch emails first
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {senders.map((sender, index) => (
              <ExpandableSenderCard
                key={sender.sender}
                sender={sender}
                rank={index + 1}
                isExpanded={expandedSender === sender.sender}
                onToggleExpand={handleToggleExpand}
                emails={senderEmails[sender.sender] || []}
                pagination={senderPagination[sender.sender] || null}
                loading={senderLoading[sender.sender] || false}
                onPageChange={handlePageChange}
              />
            ))}
          </div>
        )}

        {senders.length > 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            💡 Click any sender to see their emails with AI summaries
          </div>
        )}
      </main>
    </div>
  )
}
