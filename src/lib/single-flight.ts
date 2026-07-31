/**
 * Deduplicate concurrent async work by key. Later callers await the same promise.
 */
export async function singleFlight<T>(
  key: string,
  store: Map<string, Promise<T>>,
  fn: () => Promise<T>
): Promise<T> {
  const existing = store.get(key)
  if (existing) return existing

  const promise = fn().finally(() => {
    store.delete(key)
  })

  store.set(key, promise)
  return promise
}
