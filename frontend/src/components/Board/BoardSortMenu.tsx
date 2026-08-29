import { ArrowDownUp } from "lucide-react"
import { useState } from "react"

import type { SortDirection } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface BoardSortMenuProps {
  /** The column's heading, used to name the control for screen readers. */
  title: string
  disabled?: boolean
  onSort: (direction: SortDirection) => void
}

const OPTIONS: { direction: SortDirection; label: string }[] = [
  { direction: "newest_first", label: "Newest first" },
  { direction: "oldest_first", label: "Oldest first" },
]

/**
 * Per-column sort control.
 *
 * There is no persistent "sort mode": picking an option is a one-time
 * renumbering of the column's stored `position` values by `created_at`, which
 * a later drag freely overrides. So this is a menu of actions, not a
 * selection the control keeps highlighted.
 */
export const BoardSortMenu = ({
  title,
  disabled,
  onSort,
}: BoardSortMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Sort ${title}`}
        >
          <ArrowDownUp />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ direction, label }) => (
          <DropdownMenuItem
            key={direction}
            onSelect={() => {
              setOpen(false)
              onSort(direction)
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
