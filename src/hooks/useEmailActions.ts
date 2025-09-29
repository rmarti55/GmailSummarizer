'use client'

import { useState, useCallback } from 'react'
import { Email } from '@/types'

interface UseEmailActionsReturn {
  summarizeEmail: (emailId: string) => Promise<void>
  handleFullSync: () => void
  clearAllSummaries: () => Promise<void>
  clearAllEmails: () => Promise<void>
  handleLogout: () => Promise<void>
  isProcessing: boolean
}

interface UseEmailActionsProps {
  emails: Email[]
  setEmails: React.Dispatch<React.SetStateAction<Email[]>>
  onDataRefresh: () => void
}

export function useEmailActions({ emails, setEmails, onDataRefresh }: UseEmailActionsProps): UseEmailActionsReturn {
  const [isProcessing, setIsProcessing] = useState(false)

  const summarizeEmail = useCallback(async (emailId: string) => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId })
      })
      
      if (response.ok) {
        const data = await response.json()
        setEmails(prev => prev.map(email => 
          email.id === emailId ? { ...email, summary: data.summary } : email
        ))
      }
    } catch (error) {
      console.error('Failed to summarize:', error)
    }
    setIsProcessing(false)
  }, [setEmails])

  const handleFullSync = useCallback(() => {
    // The full sync will be handled by the EmailStatsBar component
    // We just need to refresh the data after sync
    setTimeout(() => {
      onDataRefresh()
    }, 1000)
  }, [onDataRefresh])

  const clearAllSummaries = useCallback(async () => {
    if (!confirm('Clear all existing summaries? They will be regenerated with the new adaptive system.')) return
    
    setIsProcessing(true)
    try {
      const response = await fetch('/api/clear-summaries', { method: 'POST' })
      if (response.ok) {
        // Refresh emails to show cleared summaries
        onDataRefresh()
        alert('All summaries cleared! Click "Summarize" to generate new adaptive summaries.')
      }
    } catch (error) {
      console.error('Failed to clear summaries:', error)
    }
    setIsProcessing(false)
  }, [onDataRefresh])

  const clearAllEmails = useCallback(async () => {
    if (!confirm('Clear all cached emails? They will be re-processed with clean formatting on next refresh.')) return
    
    setIsProcessing(true)
    try {
      const response = await fetch('/api/clear-emails', { method: 'POST' })
      if (response.ok) {
        // Clear emails from UI immediately
        setEmails([])
        alert('All emails cleared! Click "Refresh" to fetch and process emails with clean formatting.')
      }
    } catch (error) {
      console.error('Failed to clear emails:', error)
    }
    setIsProcessing(false)
  }, [setEmails])

  const handleLogout = useCallback(async () => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' })
      if (response.ok) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
    setIsProcessing(false)
  }, [])

  return {
    summarizeEmail,
    handleFullSync,
    clearAllSummaries,
    clearAllEmails,
    handleLogout,
    isProcessing
  }
}
