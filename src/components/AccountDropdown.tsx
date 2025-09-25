'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RefreshCw, Trash2, Mail, LogOut, ChevronDown } from 'lucide-react'

interface AccountDropdownProps {
  onRefresh: () => void
  onClearSummaries: () => void
  onClearAllEmails: () => void
  onLogout: () => void
  loading?: boolean
}

export function AccountDropdown({ 
  onRefresh, 
  onClearSummaries, 
  onClearAllEmails, 
  onLogout,
  loading = false 
}: AccountDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center space-x-1">
          <span>Account</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClearSummaries}>
          <Trash2 className="w-4 h-4 mr-2" />
          Clear Summaries
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClearAllEmails}>
          <Mail className="w-4 h-4 mr-2" />
          Clear All Emails
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
