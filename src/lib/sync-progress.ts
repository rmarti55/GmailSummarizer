// Shared sync progress state for Gmail sync operations
// In production, this should use Redis or a database for persistence

interface SyncProgress {
  current: number
  total: number
  isRunning: boolean
}

// In-memory storage for sync progress
const syncProgress = new Map<string, SyncProgress>()

export function getSyncProgress(userId: string): SyncProgress {
  return syncProgress.get(userId) || { current: 0, total: 0, isRunning: false }
}

export function setSyncProgress(userId: string, progress: SyncProgress): void {
  syncProgress.set(userId, progress)
}

export function clearSyncProgress(userId: string): void {
  syncProgress.delete(userId)
}

export function isSyncRunning(userId: string): boolean {
  const progress = syncProgress.get(userId)
  return progress?.isRunning || false
}

export { syncProgress }
