export interface Email {
  id: string
  gmail_id: string
  sender: string
  subject: string
  summary: string | null
  body_preview: string
  created_at: string
  user_id: string
  read: boolean
  email_type?: string
  urgency_level?: string
  action_required?: boolean
  classification_confidence?: number
  estimated_read_time?: number
}

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{
      name: string
      value: string
    }>
    body?: {
      data?: string
    }
    parts?: Array<{
      mimeType?: string
      body?: {
        data?: string
      }
    }>
  }
  internalDate: string
}

export interface SenderStats {
  sender: string
  count: number
  percentage: number
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}



