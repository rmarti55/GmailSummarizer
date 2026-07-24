'use client'

import { useState, useEffect } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, TrendingUp, Users, Mail, ExternalLink } from 'lucide-react'
import { syncNewEmailsFromGmail } from '@/lib/client-gmail-sync'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface IntelligenceData {
  period: '24h' | 'week' | 'month'
  totalEmails: number
  actionItems: ActionItem[]
  themes: Theme[]
  patterns: Pattern[]
  comparison: Comparison
}

interface ActionItem {
  id: string
  subject: string
  sender: string
  urgency: 'high' | 'medium' | 'low'
  timeAgo: string
  reason: string
}

interface Theme {
  name: string
  count: number
  percentage: number
  description: string
}

interface Pattern {
  type: 'volume' | 'sender' | 'timing'
  description: string
  change: 'increase' | 'decrease' | 'new'
  percentage?: number
}

interface Comparison {
  volumeChange: number
  peakTimeChange?: string
  newSenders: number
}

export default function Intelligence() {
  const [data, setData] = useState<IntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | 'week' | 'month'>('24h')
  const router = useRouter()

  const fetchIntelligence = async (period: '24h' | 'week' | 'month') => {
    setLoading(true)
    try {
      const response = await fetch(`/api/intelligence?period=${period}`)
      if (response.ok) {
        const intelligenceData = await response.json()
        setData(intelligenceData)
      } else if (response.status === 401) {
        router.push('/login')
      }
    } catch (error) {
      console.error('Failed to fetch intelligence:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchIntelligence(selectedPeriod)
  }, [selectedPeriod])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleRefresh = async () => {
    await syncNewEmailsFromGmail()
    fetchIntelligence(selectedPeriod)
  }

  const handleClearSummaries = async () => {
    try {
      await fetch('/api/clear-summaries', { method: 'POST' })
      fetchIntelligence(selectedPeriod)
    } catch (error) {
      console.error('Failed to clear summaries:', error)
    }
  }

  const handleClearAllEmails = async () => {
    try {
      await fetch('/api/clear-emails', { method: 'POST' })
      fetchIntelligence(selectedPeriod)
    } catch (error) {
      console.error('Failed to clear emails:', error)
    }
  }

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '24h': return 'Last 24 Hours'
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      default: return period
    }
  }

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'medium': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'low': return <Mail className="w-4 h-4 text-blue-500" />
      default: return <Mail className="w-4 h-4" />
    }
  }

  const getChangeIcon = (change: string) => {
    switch (change) {
      case 'increase': return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'decrease': return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
      case 'new': return <Users className="w-4 h-4 text-blue-500" />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onRefresh={handleRefresh}
        onClearSummaries={handleClearSummaries}
        onClearAllEmails={handleClearAllEmails}
        onLogout={handleLogout}
        loading={loading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Email Intelligence</h1>
          <p className="text-muted-foreground">
            Understand what's happening in your inbox with AI-powered insights
          </p>
        </div>

        {/* Time Period Selector */}
        <div className="flex space-x-2 mb-8">
          {(['24h', 'week', 'month'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              onClick={() => setSelectedPeriod(period)}
              className="relative"
            >
              {getPeriodLabel(period)}
              {data && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {period === '24h' ? data.totalEmails : 
                   period === 'week' ? data.totalEmails :
                   data.totalEmails}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loading skeletons */}
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-4/5"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Action Items - Top Priority */}
            {data.actionItems.length > 0 && (
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <span>Needs Action</span>
                    <Badge variant="destructive">{data.actionItems.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Emails that likely require your response or attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.actionItems.map((item) => (
                      <div key={item.id} className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
                        {getUrgencyIcon(item.urgency)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm truncate">{item.subject}</p>
                            <Badge variant="outline" className="text-xs">{item.timeAgo}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">From: {item.sender}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Breakdown</CardTitle>
                  <CardDescription>
                    {data.totalEmails} emails in {getPeriodLabel(selectedPeriod).toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.themes.map((theme, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 rounded-full bg-primary" style={{
                            backgroundColor: `hsl(${index * 60}, 70%, 50%)`
                          }}></div>
                          <div>
                            <p className="font-medium text-sm">{theme.name}</p>
                            <p className="text-xs text-muted-foreground">{theme.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">{theme.count}</p>
                          <p className="text-xs text-muted-foreground">{theme.percentage}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Notable Changes */}
              <Card>
                <CardHeader>
                  <CardTitle>Notable Changes</CardTitle>
                  <CardDescription>
                    Patterns and anomalies compared to your usual activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Volume Change */}
                    {data.comparison.volumeChange !== 0 && (
                      <div className="flex items-center space-x-3">
                        <TrendingUp className={`w-4 h-4 ${
                          data.comparison.volumeChange > 0 ? 'text-green-500' : 'text-red-500 rotate-180'
                        }`} />
                        <p className="text-sm">
                          <span className="font-medium">
                            {Math.abs(data.comparison.volumeChange)}% {data.comparison.volumeChange > 0 ? 'more' : 'fewer'}
                          </span> emails than usual
                        </p>
                      </div>
                    )}

                    {/* New Senders */}
                    {data.comparison.newSenders > 0 && (
                      <div className="flex items-center space-x-3">
                        <Users className="w-4 h-4 text-blue-500" />
                        <p className="text-sm">
                          <span className="font-medium">{data.comparison.newSenders} new senders</span> this period
                        </p>
                      </div>
                    )}

                    {/* Pattern Changes */}
                    {data.patterns.map((pattern, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        {getChangeIcon(pattern.change)}
                        <p className="text-sm">{pattern.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No intelligence data available</h3>
            <p className="text-muted-foreground">
              Try refreshing or check back once you have some emails synced.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
