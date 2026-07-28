export type BatchDeleteResult = {
  deletedIds: string[]
  failedIds: string[]
  error?: string
}

export async function deleteEmailFromGmail(emailId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/gmail/emails/${emailId}`, {
      method: 'DELETE',
    })
    return response.ok
  } catch (error) {
    console.error('[gmail] Client delete failed:', error)
    return false
  }
}

export async function deleteEmailsFromGmail(
  emailIds: string[]
): Promise<BatchDeleteResult | null> {
  if (emailIds.length === 0) {
    return { deletedIds: [], failedIds: [] }
  }

  try {
    const response = await fetch('/api/gmail/emails/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: emailIds }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const error =
        typeof data.error === 'string' && data.error.length > 0
          ? data.error
          : 'Failed to delete emails'
      return {
        deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
        failedIds: Array.isArray(data.failedIds) ? data.failedIds : emailIds,
        error,
      }
    }

    return {
      deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
      failedIds: Array.isArray(data.failedIds) ? data.failedIds : [],
    }
  } catch (error) {
    console.error('[gmail] Client batch delete failed:', error)
    return null
  }
}
