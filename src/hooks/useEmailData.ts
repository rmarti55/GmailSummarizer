'use client'

import { useState, useEffect, useCallback } from 'react'
import { Email } from '@/types'

interface UseEmailDataReturn {
  emails: Email[]
  loading: boolean
  totalEmailCount: number
  currentPage: number
  fetchEmails: (page?: number) => Promise<void>
  fetchEmailCount: () => Promise<void>
  handlePageChange: (page: number) => void
  setEmails: React.Dispatch<React.SetStateAction<Email[]>>
}

const EMAILS_PER_PAGE = 20

export function useEmailData(): UseEmailDataReturn {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [totalEmailCount, setTotalEmailCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchEmailCount = useCallback(async () => {
    try {
      const response = await fetch('/api/gmail/count')
      if (response.ok) {
        const data = await response.json()
        setTotalEmailCount(data.totalEmails)
      }
    } catch (error) {
      console.error('Failed to fetch email count:', error)
    }
  }, [])

  const fetchEmails = useCallback(async (page: number = 1) => {
    setLoading(true)

    try {
      const offset = (page - 1) * EMAILS_PER_PAGE
      const response = await fetch(`/api/gmail/count?limit=${EMAILS_PER_PAGE}&offset=${offset}`)
      if (response.ok) {
        const data = await response.json()
        const newEmails = data.emails || []
        
        setEmails(newEmails)
        
        // Make sure total count is set correctly - fix stale count bug
        if (totalEmailCount === 0 || newEmails.length > totalEmailCount) {
          fetchEmailCount()
        }
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    }
    
    setLoading(false)
  }, [totalEmailCount, fetchEmailCount])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    fetchEmails(page)
  }, [fetchEmails])

  // Initial data fetch
  useEffect(() => {
    fetchEmailCount()
    fetchEmails()
  }, [fetchEmailCount, fetchEmails])

  return {
    emails,
    loading,
    totalEmailCount,
    currentPage,
    fetchEmails,
    fetchEmailCount,
    handlePageChange,
    setEmails
  }
}

