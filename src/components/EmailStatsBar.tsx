'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, RefreshCw, Clock, CheckCircle, AlertTriangle, Wifi, WifiOff } from 'lucide-react'

interface EmailStats {
  totalEmails: number
  lastSyncTime: string | null
}

interface SyncProgress {
  current: number
  total: number
  isRunning: boolean
}

interface ConnectionStatus {
  connected: boolean
  error?: string
  lastChecked: string
  needsReauth?: boolean
}

interface EmailStatsBarProps {
  onFullSync?: (silent?: boolean) => void
}

export function EmailStatsBar({ onFullSync }: EmailStatsBarProps) {
  const [stats, setStats] = useState<EmailStats>({ totalEmails: 0, lastSyncTime: null })
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: true, lastChecked: new Date().toISOString() })
  const [loading, setLoading] = useState(true)
  const [showReconnectBanner, setShowReconnectBanner] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/gmail/count')
      if (response.ok) {
        const data = await response.json()
        setStats({
          totalEmails: data.totalEmails,
          lastSyncTime: data.lastSyncTime
        })
        console.info('[Gmail] stats', {
          totalEmails: data.totalEmails,
          lastSyncTime: data.lastSyncTime,
        })
      }
    } catch (error) {
      console.error('Failed to fetch email stats:', error)
    }
    setLoading(false)
  }

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch('/api/gmail/connection-status')
      const data = await response.json()

      console.info('[Gmail] connection-status', JSON.stringify(data))

      setConnectionStatus(data)

      if (!data.connected) {
        setShowReconnectBanner(true)
      } else {
        setShowReconnectBanner(false)
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error)
      setConnectionStatus({
        connected: false,
        error: 'Failed to check connection',
        lastChecked: new Date().toISOString()
      })
    }
  }

  const fetchSyncProgress = async () => {
    try {
      const response = await fetch('/api/gmail/sync-status')
      if (response.ok) {
        const progress = await response.json()
        setSyncProgress(progress)

        if (progress.isRunning) {
          fetchStats()
          onFullSync?.(true)

          // Process next sync chunk (Vercel-safe resumable sync)
          await fetch('/api/gmail/full-sync', { method: 'POST' })
          setTimeout(fetchSyncProgress, 2000)
        } else {
          fetchStats()
          onFullSync?.(false)
        }
      }
    } catch (error) {
      console.error('Failed to fetch sync progress:', error)
    }
  }

  const handleFullSync = async () => {
    try {
      const response = await fetch('/api/gmail/full-sync', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        if (data.progress) {
          setSyncProgress(data.progress)
        }
        onFullSync?.(false)
        fetchSyncProgress()
      } else {
        const data = await response.json()
        console.error('Failed to start full sync:', data.error)
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

  const handleReconnect = () => {
    window.location.href = '/api/auth/signin?consent=true'
  }

  const dismissReconnectBanner = () => {
    setShowReconnectBanner(false)
  }

  useEffect(() => {
    fetchStats()
    fetchConnectionStatus()

    // Resume polling if sync is already running (e.g. page refresh mid-sync)
    fetch('/api/gmail/sync-status')
      .then((response) => (response.ok ? response.json() : null))
      .then((progress) => {
        if (progress) {
          setSyncProgress(progress)
          if (progress.isRunning) {
            fetchSyncProgress()
          }
        }
      })
      .catch((error) => console.error('Failed to check sync status:', error))
    
    // Set up 10-minute polling for connection status
    const connectionInterval = setInterval(fetchConnectionStatus, 10 * 60 * 1000) // 10 minutes
    
    return () => clearInterval(connectionInterval)
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
    <>
      {showReconnectBanner && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  {connectionStatus.error ?? 'Gmail connection lost. Your emails may be out of sync.'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReconnect}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                >
                  Reconnect Gmail
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={dismissReconnectBanner}
                  className="text-yellow-600 hover:bg-yellow-100"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {connectionStatus.connected ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                connectionStatus.connected ? 'text-green-700' : 'text-red-700'
              }`}>
                Gmail {connectionStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
              {!connectionStatus.connected && connectionStatus.error && (
                <span className="text-xs text-red-600 hidden sm:inline">
                  — {connectionStatus.error}
                </span>
              )}
            </div>
            
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

            {syncProgress?.isRunning && syncProgress.total > 0 && (
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
            {syncProgress?.isRunning && syncProgress.total === 0 && (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Preparing sync...</span>
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
    </>
  )
}
