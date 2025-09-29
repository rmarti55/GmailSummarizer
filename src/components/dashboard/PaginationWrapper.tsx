import React from 'react'
import { PaginationControls } from '@/components/PaginationControls'

interface PaginationWrapperProps {
  currentPage: number
  totalEmailCount: number
  onPageChange: (page: number) => void
  loading: boolean
  emailsLength: number
}

const EMAILS_PER_PAGE = 20

export function PaginationWrapper({ 
  currentPage, 
  totalEmailCount, 
  onPageChange, 
  loading, 
  emailsLength 
}: PaginationWrapperProps) {
  // Don't show pagination if loading or not enough emails
  if (loading || emailsLength === 0 || totalEmailCount <= EMAILS_PER_PAGE) {
    return null
  }

  const totalPages = Math.ceil(totalEmailCount / EMAILS_PER_PAGE)

  return (
    <>
      {/* Top Pagination Controls */}
      <div className="mb-4">
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalEmailCount}
          itemsPerPage={EMAILS_PER_PAGE}
          onPageChange={onPageChange}
        />
      </div>
      
      {/* This component wraps the email list, so we return a fragment */}
      {/* The actual email list will be rendered between top and bottom pagination */}
    </>
  )
}

export function BottomPagination({ 
  currentPage, 
  totalEmailCount, 
  onPageChange, 
  loading, 
  emailsLength 
}: PaginationWrapperProps) {
  // Don't show pagination if loading or not enough emails
  if (loading || emailsLength === 0 || totalEmailCount <= EMAILS_PER_PAGE) {
    return null
  }

  const totalPages = Math.ceil(totalEmailCount / EMAILS_PER_PAGE)

  return (
    <div className="mt-4">
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalEmailCount}
        itemsPerPage={EMAILS_PER_PAGE}
        onPageChange={onPageChange}
      />
    </div>
  )
}
