export interface Email {
  id: string
  gmail_id: string
  sender: string
  subject: string
  summary: string | null
  created_at: string
  user_id: string
  read: boolean
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
      body?: {
        data?: string
      }
    }>
  }
  internalDate: string
}



