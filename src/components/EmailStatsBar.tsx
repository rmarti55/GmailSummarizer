'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, RefreshCw, Clock, CheckCircle, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { resolveSyncCta, shouldHydrateSyncProgress } from '@/lib/sync-cta'
import type { SyncJobStatus } from '@/lib/sync-jobs'

interface EmailStats {
  totalEmails: number
  lastSyncTime: string | null
}

interface SyncProgress {
  current: number
  total: number
  isRunning: boolean
  status?: SyncJobStatus
  error?: string | null
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

const SYNC_ERROR_BACKOFF_MS = 2000
const SYNC_COMPLETE_FLASH_MS = 2000

export function EmailStatsBar({ onFullSync }: EmailStatsBarProps) {
  const [stats, setStats] = useState<EmailStats>({ totalEmails: 0, lastSyncTime: null })
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: true,
    lastChecked: new Date().toISOString(),
  })
  const [loading, setLoading] = useState(true)
  const [showReconnectBanner, setShowReconnectBanner] = useState(false)
  const syncLoopRunningRef = useRef(false)
  const completeFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashSyncComplete = () => {
    if (completeFlashTimeoutRef.current) {
      clearTimeout(completeFlashTimeoutRef.current)
    }
    setJustCompleted(true)
    completeFlashTimeoutRef.current = setTimeout(() => {
      setJustCompleted(false)
      completeFlashTimeoutRef.current = null
    }, SYNC_COMPLETE_FLASH_MS)
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/gmail/count')
      if (response.ok) {
        const data = await response.json()
        setStats({
          totalEmails: data.totalEmails,
          lastSyncTime: data.lastSyncTime,
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

      if (!data.connected && data.needsReauth) {
        setShowReconnectBanner(true)
      } else if (data.connected) {
        setShowReconnectBanner(false)
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error)
      setConnectionStatus({
        connected: false,
        error: 'Failed to check connection',
        lastChecked: new Date().toISOString(),
      })
    }
  }

  const readSyncStatus = async (): Promise<SyncProgress | null> => {
    try {
      const response = await fetch('/api/gmail/sync-status')
      if (!response.ok) return null
      return (await response.json()) as SyncProgress
    } catch (error) {
      console.error('Failed to fetch sync progress:', error)
      return null
    }
  }

  const handleSyncFinished = (progress: SyncProgress | null | undefined) => {
    onFullSync?.(false)
    void fetchStats()

    if (progress?.status === 'failed' || progress?.error) {
      setSyncProgress(progress)
      return
    }

    flashSyncComplete()
    setSyncProgress(null)
    // Ack completed → idle in DB (sync-status auto-idles completed jobs).
    void readSyncStatus()
  }

  const runSyncLoop = async () => {
    if (syncLoopRunningRef.current) {
      return
    }

    syncLoopRunningRef.current = true

    try {
      while (true) {
        const response = await fetch('/api/gmail/full-sync', { method: 'POST' })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          console.error('Sync chunk failed:', data.error ?? response.statusText)

          if (response.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, SYNC_ERROR_BACKOFF_MS))
            continue
          }

          const status = await readSyncStatus()
          setSyncProgress(
            status ?? {
              current: 0,
              total: 0,
              isRunning: false,
              status: 'failed',
              error: typeof data.error === 'string' ? data.error : 'Sync failed',
            }
          )
          onFullSync?.(false)
          break
        }

        const data = await response.json()
        if (data.progress) {
          setSyncProgress(data.progress)
        }

        void fetchStats()
        onFullSync?.(true)

        if (!data.progress?.isRunning) {
          handleSyncFinished(data.progress)
          break
        }
      }
    } catch (error) {
      console.error('Failed to process sync chunk:', error)
      const status = await readSyncStatus()
      if (status?.isRunning) {
        setTimeout(() => {
          syncLoopRunningRef.current = false
          void runSyncLoop()
        }, SYNC_ERROR_BACKOFF_MS)
        return
      }

      setSyncProgress(
        status ?? {
          current: 0,
          total: 0,
          isRunning: false,
          status: 'failed',
          error: 'Sync interrupted — try again',
        }
      )
      onFullSync?.(false)
      syncLoopRunningRef.current = false
      return
    }

    syncLoopRunningRef.current = false
  }

  const handleFullSync = async () => {
    setJustCompleted(false)
    setSyncProgress({ current: 0, total: 0, isRunning: true, status: 'running' })

    try {
      const response = await fetch('/api/gmail/full-sync', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        if (data.progress) {
          setSyncProgress(data.progress)
        }

        if (data.progress?.isRunning) {
          void runSyncLoop()
        } else {
          handleSyncFinished(data.progress)
        }
      } else {
        const data = await response.json().catch(() => ({}))
        const error =
          typeof data.error === 'string' ? data.error : 'Failed to start full sync'
        console.error('Failed to start full sync:', error)
        setSyncProgress({
          current: 0,
          total: 0,
          isRunning: false,
          status: 'failed',
          error,
        })
      }
    } catch (error) {
      console.error('Failed to start full sync:', error)
      setSyncProgress({
        current: 0,
        total: 0,
        isRunning: false,
        status: 'failed',
        error: 'Failed to start full sync',
      })
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
    void fetchStats()
    void fetchConnectionStatus()

    // Resume only if a sync is already running (e.g. page refresh mid-sync).
    // Completed durable jobs must not re-lock the CTA.
    void readSyncStatus().then((progress) => {
      if (!progress) return

      const hydrate = shouldHydrateSyncProgress(progress)
      if (hydrate === 'resume') {
        setSyncProgress(progress)
        void runSyncLoop()
      } else if (hydrate === 'failed') {
        setSyncProgress(progress)
      }
    })

    const connectionInterval = setInterval(fetchConnectionStatus, 10 * 60 * 1000)

    return () => {
      clearInterval(connectionInterval)
      if (completeFlashTimeoutRef.current) {
        clearTimeout(completeFlashTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only init
  }, [])

  const cta = resolveSyncCta({
    isRunning: Boolean(syncProgress?.isRunning),
    status: syncProgress?.status,
    justCompleted,
    error: syncProgress?.error,
  })

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
                <span
                  className={`text-sm font-medium ${
                    connectionStatus.connected ? 'text-green-700' : 'text-red-700'
                  }`}
                >
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
                    Syncing... {syncProgress.current.toLocaleString()}/
                    {syncProgress.total.toLocaleString()} emails
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
              {cta === 'retry' && syncProgress?.error && (
                <span className="text-xs text-red-600 hidden md:inline max-w-xs truncate">
                  {syncProgress.error}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {cta === 'syncing' ? (
                <Button variant="outline" size="sm" disabled>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Syncing...
                </Button>
              ) : cta === 'complete' ? (
                <Button variant="outline" size="sm" disabled>
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Sync Complete
                </Button>
              ) : cta === 'retry' ? (
                <Button variant="outline" size="sm" onClick={handleFullSync}>
                  <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                  Retry sync
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleFullSync}>
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
