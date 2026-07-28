export interface SelectChangeOptions {
  shiftKey?: boolean
}

export interface SelectionChangeResult {
  selectedIds: Set<string>
  anchorId: string | null
}

export function applyEmailSelectionChange(
  prevSelectedIds: Set<string>,
  anchorId: string | null,
  emailIdsInView: string[],
  clickedId: string,
  selected: boolean,
  options?: SelectChangeOptions
): SelectionChangeResult {
  const { shiftKey = false } = options ?? {}

  if (
    shiftKey &&
    anchorId &&
    emailIdsInView.includes(anchorId) &&
    emailIdsInView.includes(clickedId)
  ) {
    const anchorIndex = emailIdsInView.indexOf(anchorId)
    const clickedIndex = emailIdsInView.indexOf(clickedId)
    const start = Math.min(anchorIndex, clickedIndex)
    const end = Math.max(anchorIndex, clickedIndex)
    const rangeIds = emailIdsInView.slice(start, end + 1)

    const next = new Set(prevSelectedIds)
    for (const id of rangeIds) {
      if (selected) next.add(id)
      else next.delete(id)
    }

    return { selectedIds: next, anchorId: clickedId }
  }

  const next = new Set(prevSelectedIds)
  if (selected) next.add(clickedId)
  else next.delete(clickedId)

  return { selectedIds: next, anchorId: clickedId }
}
