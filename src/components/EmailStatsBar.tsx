'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, RefreshCw, Clock, CheckCircle } from 'lucide-react'

interface EmailStats {
  totalEmails: number
  lastSyncTime: string | null
}

interface SyncProgress {
  current: number
  total: number
  isRunning: boolean
}

interface EmailStatsBarProps {
  onFullSync: () => void
}

export function EmailStatsBar({ onFullSync }: EmailStatsBarProps) {
  const [stats, setStats] = useState<EmailStats>({ totalEmails: 0, lastSyncTime: null })
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [pollCount, setPollCount] = useState(0)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/gmail/count')
      if (response.ok) {
        const data = await response.json()
        setStats({
          totalEmails: data.totalEmails,
          lastSyncTime: data.lastSyncTime
        })
      }
    } catch (error) {
      console.error('Failed to fetch email stats:', error)
    }
    setLoading(false)
  }

  const fetchSyncProgress = async () => {
    try {
      const response = await fetch('/api/gmail/sync-status')
      if (response.ok) {
        const progress = await response.json()
        setSyncProgress(progress)
        setPollCount(prev => prev + 1)
        
        // If sync is running, continue polling (max 30 attempts = 1 minute)
        if (progress.isRunning && pollCount < 30) {
          setTimeout(fetchSyncProgress, 2000)
        } else {
          // Sync completed or max polls reached, refresh stats
          fetchStats()
          setPollCount(0)
        }
      }
    } catch (error) {
      console.error('Failed to fetch sync progress:', error)
      setPollCount(0)
    }
  }

  const handleFullSync = async () => {
    try {
      setPollCount(0) // Reset poll count
      const response = await fetch('/api/gmail/full-sync', { method: 'POST' })
      if (response.ok) {
        onFullSync()
        // Start polling for progress
        fetchSyncProgress()
      } else {
        const data = await response.json()
        if (response.status === 409) {
          // Sync already running, start polling
          fetchSyncProgress()
        } else {
          console.error('Failed to start full sync:', data.error)
        }
      }
    } catch (error) {
      console.error('Failed to start full sync:', error)
    }
  }

  const formatLastSync = (lastSyncTime: string | null) => {
    if (!lastSyncTime) return 'Never synced'
    
    const now = new Date()
    const syncTime = new Date(lastSyncTime)
    const diffMs = now.getTime() - syncTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just synced'
    if (diffMins < 60) return `${diffMins} min ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading email stats...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-primary/5 border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {stats.totalEmails.toLocaleString()} emails loaded
              </span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Last synced {formatLastSync(stats.lastSyncTime)}</span>
            </div>

            {syncProgress?.isRunning && (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Syncing... {syncProgress.current.toLocaleString()}/{syncProgress.total.toLocaleString()} emails
                </span>
                <Badge variant="info" className="text-xs">
                  {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {syncProgress?.isRunning ? (
              <Button variant="outline" size="sm" disabled>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Syncing...
              </Button>
            ) : syncProgress && !syncProgress.isRunning && syncProgress.current > 0 ? (
              <Button variant="outline" size="sm" disabled>
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                Sync Complete
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleFullSync}
              >
                <Mail className="w-4 h-4 mr-2" />
                Get All My Emails
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
