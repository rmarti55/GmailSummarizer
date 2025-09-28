'use client'

import { useState } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  totalCount: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalCount,
  itemsPerPage,
  onPageChange,
}: PaginationControlsProps) {
  const [jumpValue, setJumpValue] = useState('')

  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalCount)

  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= 5) {
      // Show all pages if 5 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push('ellipsis')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i)
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const handleJumpSubmit = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e || e.key === 'Enter') {
      const page = parseInt(jumpValue)
      if (page >= 1 && page <= totalPages) {
        onPageChange(page)
        setJumpValue('')
      }
    }
  }

  const handleJumpClick = () => {
    handleJumpSubmit()
  }

  return (
    <div className="my-6">
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-between bg-muted/50 rounded-lg px-6 py-4 border shadow-sm">
        {/* Left: Range display */}
        <div className="text-sm font-medium text-foreground shrink-0 min-w-fit">
          {startItem}-{endItem} of {totalCount.toLocaleString()}
        </div>
        
        {/* Center: Pagination controls */}
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => onPageChange(currentPage - 1)}
                className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-accent"}
              />
            </PaginationItem>
            
            {getVisiblePages().map((page, index) => (
              <PaginationItem key={index}>
                {page === 'ellipsis' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    onClick={() => onPageChange(page as number)}
                    isActive={page === currentPage}
                    className="cursor-pointer hover:bg-accent"
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => onPageChange(currentPage + 1)}
                className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-accent"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        
        {/* Right: Jump to page */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Jump:</span>
          <Input
            type="number"
            placeholder="Page"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={handleJumpSubmit}
            className="w-20 h-9 text-center"
            min={1}
            max={totalPages}
            aria-label={`Jump to page (1-${totalPages})`}
          />
          <Button
            onClick={handleJumpClick}
            variant="outline"
            size="sm"
            className="h-9 px-3"
            disabled={!jumpValue || parseInt(jumpValue) < 1 || parseInt(jumpValue) > totalPages}
          >
            Go
          </Button>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-4">
        {/* Range display */}
        <div className="text-center bg-muted/50 rounded-lg px-4 py-3 border shadow-sm">
          <div className="text-xs font-medium text-foreground">
            {startItem}-{endItem} of {totalCount.toLocaleString()}
          </div>
        </div>
        
        {/* Navigation controls */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3 border shadow-sm">
          <Button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 min-w-[100px]"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="text-sm font-medium text-foreground">
            {currentPage} of {totalPages}
          </div>
          
          <Button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 min-w-[100px]"
            aria-label="Next page"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Jump to page */}
        <div className="bg-muted/50 rounded-lg px-4 py-3 border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">Jump:</span>
            <Input
              type="number"
              placeholder="##"
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={handleJumpSubmit}
              className="flex-1 text-center min-w-[60px]"
              min={1}
              max={totalPages}
              aria-label={`Jump to page (1-${totalPages})`}
            />
            <Button
              onClick={handleJumpClick}
              variant="default"
              size="sm"
              disabled={!jumpValue || parseInt(jumpValue) < 1 || parseInt(jumpValue) > totalPages}
              className="shrink-0 px-4"
            >
              Go
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
