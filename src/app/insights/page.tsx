'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/AppHeader'
import { TrendingUp, Clock, Calendar, Users, BarChart3 } from 'lucide-react'

interface Analytics {
  peakHour: string | null
  peakDay: string | null
  totalAnalyzed: number
  avgPerDay: number
  topSenders: Array<{
    sender: string
    count: number
    percentage: number
  }>
  emailTypes: Record<string, number>
}

export default function InsightsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const handleRefresh = async () => {
    fetchAnalytics()
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
        setAnalytics(null)
        alert('All emails cleared! Visit Dashboard to refresh and process emails.')
      }
    } catch (error) {
      console.error('Failed to clear emails:', error)
    }
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/insights')
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
      } else {
        console.error('Failed to fetch analytics')
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAnalytics()
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
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">
              Email Insights
            </h2>
          </div>
          <p className="text-muted-foreground">
            Understand your email patterns and behavior
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-6 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analytics ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Peak Email Time</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {analytics.peakHour || 'Not enough data'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Busiest Day</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {analytics.peakDay || 'Not enough data'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Daily Average</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {analytics.avgPerDay} emails
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Emails Analyzed</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {analytics.totalAnalyzed.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Senders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Top Email Senders</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.topSenders.map((sender, index) => (
                      <div key={sender.sender} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              #{index + 1}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-foreground truncate max-w-48">
                              {sender.sender}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {sender.count} emails
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {sender.percentage}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Email Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Email Categories</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(analytics.emailTypes)
                      .sort(([,a], [,b]) => b - a)
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="font-medium text-foreground capitalize">
                            {type.replace('_', ' ')}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground">
                              {count} emails
                            </span>
                            <Badge variant="outline">
                              {Math.round((count / analytics.totalAnalyzed) * 100)}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No email data found
              </h3>
              <p className="text-muted-foreground">
                Visit the Dashboard to fetch emails first
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
