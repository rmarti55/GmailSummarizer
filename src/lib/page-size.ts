export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export function clampPageSize(limit: number): PageSize {
  if (PAGE_SIZE_OPTIONS.includes(limit as PageSize)) {
    return limit as PageSize
  }
  return 10
}
