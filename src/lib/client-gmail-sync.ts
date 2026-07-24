export async function syncNewEmailsFromGmail(): Promise<boolean> {
  try {
    const response = await fetch('/api/gmail')
    return response.ok
  } catch (error) {
    console.error('[gmail] Client incremental sync failed:', error)
    return false
  }
}
