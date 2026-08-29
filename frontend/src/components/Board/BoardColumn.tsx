import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { ReactNode } from "react"

import type { ItemPublic, ItemStatus } from "@/client"
import { cn } from "@/lib/utils"
import { BoardCard } from "./BoardCard"

interface BoardColumnProps {
  status: ItemStatus
  title: string
  items: ItemPublic[]
  /** Slot for the per-column sort control (#10). */
  action?: ReactNode
}

export const BoardColumn = ({
  status,
  title,
  items,
  action,
}: BoardColumnProps) => {
  // Droppable on the column itself so an empty column is still a drop target.
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section
      aria-label={title}
      data-testid={`board-column-${status}`}
      className="flex min-w-0 flex-1 flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          {title}{" "}
          <span className="text-muted-foreground font-normal">
            ({items.length})
          </span>
        </h2>
        {action}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "bg-muted" : "bg-muted/30",
        )}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <BoardCard key={item.id} item={item} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <p className="m-auto text-sm text-muted-foreground">No items</p>
        )}
      </div>
    </section>
  )
}
