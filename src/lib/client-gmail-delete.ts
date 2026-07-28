const BATCH_DELETE_CHUNK_SIZE = 50

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

async function deleteEmailBatch(
  emailIds: string[]
): Promise<{ deletedIds: string[]; failedIds: string[]; error?: string }> {
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
    return { deletedIds: [], failedIds: emailIds, error }
  }

  return {
    deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
    failedIds: Array.isArray(data.failedIds) ? data.failedIds : [],
  }
}

export async function deleteEmailsFromGmail(
  emailIds: string[]
): Promise<BatchDeleteResult | null> {
  if (emailIds.length === 0) {
    return { deletedIds: [], failedIds: [] }
  }

  try {
    const deletedIds: string[] = []
    const failedIds: string[] = []
    let lastError: string | undefined

    for (let index = 0; index < emailIds.length; index += BATCH_DELETE_CHUNK_SIZE) {
      const chunk = emailIds.slice(index, index + BATCH_DELETE_CHUNK_SIZE)
      const result = await deleteEmailBatch(chunk)

      deletedIds.push(...result.deletedIds)
      failedIds.push(...result.failedIds)

      if (result.error) {
        lastError = result.error
      }
    }

    if (deletedIds.length === 0 && lastError) {
      return { deletedIds, failedIds, error: lastError }
    }

    return { deletedIds, failedIds, error: lastError }
  } catch (error) {
    console.error('[gmail] Client batch delete failed:', error)
    return null
  }
}
