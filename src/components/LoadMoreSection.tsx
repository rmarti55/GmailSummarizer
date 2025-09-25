'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, ArrowDown, Zap } from 'lucide-react'

interface LoadMoreSectionProps {
  currentCount: number
  totalCount: number
  onLoadMore: () => void
  onLoadAll: () => void
  loading: boolean
}

export function LoadMoreSection({ 
  currentCount, 
  totalCount, 
  onLoadMore, 
  onLoadAll, 
  loading 
}: LoadMoreSectionProps) {
  const remaining = totalCount - currentCount
  
  if (totalCount === 0 || remaining <= 0) {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-700 dark:text-green-300">All emails loaded!</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You&apos;re viewing all {totalCount.toLocaleString()} emails from your inbox
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <ArrowDown className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-primary">
              Load More Emails
            </h3>
          </div>
          
          <p className="text-sm text-muted-foreground">
            📊 Show more emails • {remaining.toLocaleString()} remaining
          </p>

          <div className="flex items-center justify-center space-x-3">
            <Button
              onClick={onLoadMore}
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Show Next 20
                </>
              )}
            </Button>

            <Button
              onClick={onLoadAll}
              disabled={loading}
              variant="default"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Loading All...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Show All
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            💡 &quot;Show Next 20&quot; for quick browsing • &quot;Show All&quot; for complete access
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
