import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import type { ItemPublic } from "@/client"
import { ItemActionsMenu } from "@/components/Items/ItemActionsMenu"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BoardCardProps {
  item: ItemPublic
}

/**
 * One draggable item on the board.
 *
 * The grip is the drag handle so the actions menu stays clickable. It is a
 * real button, which makes the card reachable — and movable — by keyboard.
 */
export const BoardCard = ({ item }: BoardCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex flex-row items-start gap-2 p-3",
        isDragging && "opacity-50",
      )}
      data-testid="board-card"
      data-item-id={item.id}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="mt-0.5 cursor-grab touch-none text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={`Drag ${item.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight break-words">{item.title}</p>
        {item.description && (
          <p className="mt-1 text-sm text-muted-foreground break-words">
            {item.description}
          </p>
        )}
      </div>
      <ItemActionsMenu item={item} />
    </Card>
  )
}
