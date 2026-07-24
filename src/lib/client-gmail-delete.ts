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
): Promise<{ deletedIds: string[]; failedIds: string[] } | null> {
  try {
    const response = await fetch('/api/gmail/emails/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: emailIds }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
      failedIds: Array.isArray(data.failedIds) ? data.failedIds : [],
    }
  } catch (error) {
    console.error('[gmail] Client batch delete failed:', error)
    return null
  }
}
