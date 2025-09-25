import React, { useState } from 'react'
import { Sparkles, AlertTriangle, Clock, Info, ShoppingBag, ChevronDown } from 'lucide-react'
import { Email } from '../types'

interface AdaptiveSummaryProps {
  email: Email
}

export function AdaptiveSummary({ email }: AdaptiveSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  if (!email.summary) return null


  // Determine visual styling based on email classification
  const getSummaryStyles = () => {
    switch (email.email_type) {
      case 'critical_action':
        return {
          containerClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
          iconClass: 'text-red-600 dark:text-red-400',
          titleClass: 'text-red-900 dark:text-red-100',
          textClass: 'text-red-800 dark:text-red-200',
          icon: AlertTriangle,
          title: 'Urgent Action Required'
        }
      
      case 'quick_action':
        return {
          containerClass: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
          iconClass: 'text-amber-600 dark:text-amber-400', 
          titleClass: 'text-amber-900 dark:text-amber-100',
          textClass: 'text-amber-800 dark:text-amber-200',
          icon: Clock,
          title: 'Quick Action Needed'
        }
      
      case 'commercial':
        return {
          containerClass: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
          iconClass: 'text-purple-600 dark:text-purple-400',
          titleClass: 'text-purple-900 dark:text-purple-100', 
          textClass: 'text-purple-800 dark:text-purple-200',
          icon: ShoppingBag,
          title: 'Promotion'
        }
      
      case 'fyi_update':
        return {
          containerClass: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          iconClass: 'text-green-600 dark:text-green-400',
          titleClass: 'text-green-900 dark:text-green-100',
          textClass: 'text-green-800 dark:text-green-200', 
          icon: Info,
          title: 'Update'
        }
      
      case 'complex_content':
        return {
          containerClass: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
          iconClass: 'text-indigo-600 dark:text-indigo-400',
          titleClass: 'text-indigo-900 dark:text-indigo-100',
          textClass: 'text-indigo-800 dark:text-indigo-200',
          icon: Sparkles,
          title: 'Key Points'
        }
      
      default:
        return {
          containerClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          iconClass: 'text-blue-600 dark:text-blue-400',
          titleClass: 'text-blue-900 dark:text-blue-100',
          textClass: 'text-blue-800 dark:text-blue-200',
          icon: Sparkles,
          title: 'AI Summary'
        }
    }
  }

  const styles = getSummaryStyles()
  const IconComponent = styles.icon

  // Format the summary for better readability
  const formatSummary = (summary: string) => {
    // Split into paragraphs and preserve line breaks
    const paragraphs = summary.split('\n\n').filter(p => p.trim())
    
    return paragraphs.map((paragraph, index) => {
      // Handle bullet points
      if (paragraph.includes('•') || paragraph.includes('*')) {
        const lines = paragraph.split('\n')
        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lineIndex) => (
              <div key={lineIndex} className="text-sm">
                {line.trim()}
              </div>
            ))}
          </div>
        )
      }
      
      // Regular paragraphs
      return (
        <p key={index} className="text-sm mb-2 last:mb-0">
          {paragraph.trim()}
        </p>
      )
    })
  }

  return (
    <div className={`rounded-lg p-4 border ${styles.containerClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <IconComponent className={`w-4 h-4 ${styles.iconClass}`} />
          <span className={`text-sm font-medium ${styles.titleClass}`}>
            {styles.title}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`ml-1 p-0.5 rounded-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${styles.iconClass}`}
            aria-label={isExpanded ? 'Collapse summary' : 'Expand summary'}
          >
            <ChevronDown 
              className={`w-3 h-3 transition-transform duration-200 ${
                isExpanded ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>
        </div>
        
        {/* Show estimated read time and urgency for actionable emails */}
        {email.action_required && (
          <div className="flex items-center space-x-2">
            {email.estimated_read_time && (
              <span className={`text-xs ${styles.iconClass}`}>
                ~{email.estimated_read_time}s
              </span>
            )}
            {email.urgency_level === 'high' && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                High Priority
              </span>
            )}
          </div>
        )}
      </div>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={styles.textClass}>
          {formatSummary(email.summary)}
        </div>
      </div>
      

      {/* Show classification confidence for debugging (can remove in production) */}
      {process.env.NODE_ENV === 'development' && email.classification_confidence && (
        <div className="mt-1 text-xs text-gray-400">
          Classification: {email.email_type} ({Math.round(email.classification_confidence * 100)}% confidence)
        </div>
      )}
    </div>
  )
}
