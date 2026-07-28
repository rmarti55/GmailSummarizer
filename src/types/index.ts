export type SenderKind = 'person' | 'organization' | 'unknown'

export interface Email {
  id: string
  gmail_id: string
  sender: string
  sender_key?: string
  from_email?: string | null
  from_domain?: string | null
  sender_kind?: SenderKind
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

export interface GmailMessagePart {
  mimeType?: string
  body?: {
    data?: string
  }
  parts?: GmailMessagePart[]
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
    parts?: GmailMessagePart[]
  }
  internalDate: string
}

export interface SenderStats {
  sender: string
  count: number
  percentage: number
  kind: SenderKind
}

export interface SenderStatsResponse {
  senders: SenderStats[]
  counts: {
    all: number
    person: number
    organization: number
    unknown: number
  }
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}



