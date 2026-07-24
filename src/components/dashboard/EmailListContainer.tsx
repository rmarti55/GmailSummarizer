import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Mail, RefreshCw } from 'lucide-react'
import { EmailCard } from '@/components/EmailCard'
import { Email } from '@/types'

interface EmailListContainerProps {
  emails: Email[]
  loading: boolean
}

export function EmailListContainer({ emails, loading }: EmailListContainerProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No emails found</h3>
          <p className="text-muted-foreground mb-4">
            Connect your Gmail account to see your emails here
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {emails.map((email) => (
        <EmailCard
          key={email.id}
          email={email}
          isSummarizing={false}
        />
      ))}
    </div>
  )
}
