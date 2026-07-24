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
