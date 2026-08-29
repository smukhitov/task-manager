import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { type ItemPublic, type ItemStatus, ItemsService } from "@/client"
import { Card } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { BoardColumn } from "./BoardColumn"
import { BOARD_COLUMNS, isItemStatus } from "./columns"

type Columns = Record<ItemStatus, ItemPublic[]>

interface MoveVariables {
  id: string
  target_status: ItemStatus
  target_index: number
}

const emptyColumns = (): Columns => ({
  todo: [],
  in_progress: [],
  completed: [],
})

/** Group the caller's items into the three columns, ordered by `position`. */
const groupByStatus = (items: ItemPublic[]): Columns => {
  const columns = emptyColumns()
  for (const item of items) {
    columns[item.status].push(item)
  }
  for (const status of Object.keys(columns) as ItemStatus[]) {
    columns[status].sort((a, b) => a.position - b.position)
  }
  return columns
}

/** Which column a draggable id belongs to — the id is a status or an item. */
const findColumn = (columns: Columns, id: string): ItemStatus | null => {
  if (isItemStatus(id)) {
    return id
  }
  return (
    (Object.keys(columns) as ItemStatus[]).find((status) =>
      columns[status].some((item) => item.id === id),
    ) ?? null
  )
}

export const Board = () => {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const { showErrorToast } = useCustomToast()

  const { data: items } = useQuery({
    queryFn: async () =>
      (await ItemsService.readItems({ query: { skip: 0, limit: 100 } })).data,
    queryKey: ["items"],
  })

  // The board is own-items-only for every role, superusers included, because
  // `position` is only defined within an (owner, status) group. `/items` keeps
  // its superuser-sees-all behaviour; this divergence is deliberate (see #7).
  const serverColumns = useMemo(() => {
    const own = (items?.data ?? []).filter(
      (item) => item.owner_id === currentUser?.id,
    )
    return groupByStatus(own)
  }, [items, currentUser?.id])

  // While a drag is in flight the local arrangement wins, so the card follows
  // the pointer across columns before the server has been told anything.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const columns = dragColumns ?? serverColumns

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const moveMutation = useMutation({
    mutationFn: ({ id, target_status, target_index }: MoveVariables) =>
      ItemsService.moveItem({
        path: { id },
        body: { target_status, target_index },
      }),
    onError: handleError.bind(showErrorToast),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] })
      // Hand back to the server's arrangement only once it has been refetched,
      // so the card never flickers into its old slot in between. On failure
      // this is what snaps the board back.
      setDragColumns(null)
    },
  })

  const activeItem =
    activeId === null
      ? null
      : (Object.values(columns)
          .flat()
          .find((item) => item.id === activeId) ?? null)

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setDragColumns(serverColumns)
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragColumns) return

    const activeColumn = findColumn(dragColumns, String(active.id))
    const overColumn = findColumn(dragColumns, String(over.id))
    if (!activeColumn || !overColumn || activeColumn === overColumn) return

    setDragColumns((current) => {
      if (!current) return current
      const moved = current[activeColumn].find(
        (item) => item.id === String(active.id),
      )
      if (!moved) return current

      const overItems = current[overColumn]
      const overIndex = overItems.findIndex(
        (item) => item.id === String(over.id),
      )
      // Dropping on the column itself (or past the last card) appends.
      const insertAt = overIndex === -1 ? overItems.length : overIndex

      return {
        ...current,
        [activeColumn]: current[activeColumn].filter(
          (item) => item.id !== String(active.id),
        ),
        [overColumn]: [
          ...overItems.slice(0, insertAt),
          moved,
          ...overItems.slice(insertAt),
        ],
      }
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const working = dragColumns
    setActiveId(null)

    if (!over || !working) {
      setDragColumns(null)
      return
    }

    const id = String(active.id)
    const targetStatus = findColumn(working, String(over.id))
    if (!targetStatus) {
      setDragColumns(null)
      return
    }

    const fromIndex = working[targetStatus].findIndex((item) => item.id === id)
    const overIndex = working[targetStatus].findIndex(
      (item) => item.id === String(over.id),
    )
    const targetIndex =
      overIndex === -1 ? working[targetStatus].length - 1 : overIndex

    const settled =
      fromIndex === -1
        ? working
        : {
            ...working,
            [targetStatus]: arrayMove(
              working[targetStatus],
              fromIndex,
              targetIndex,
            ),
          }
    setDragColumns(settled)

    const origin = findColumn(serverColumns, id)
    const originIndex = origin
      ? serverColumns[origin].findIndex((item) => item.id === id)
      : -1
    if (origin === targetStatus && originIndex === targetIndex) {
      // Picked up and put back where it started — nothing to persist.
      setDragColumns(null)
      return
    }

    // Any column-to-column direction is allowed; the server owns `position`,
    // so we send the drop index and never a computed position value.
    moveMutation.mutate({
      id,
      target_status: targetStatus,
      target_index: Math.max(targetIndex, 0),
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDragColumns(null)
      }}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {BOARD_COLUMNS.map(({ status, title }) => (
          <BoardColumn
            key={status}
            status={status}
            title={title}
            items={columns[status]}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <Card className="p-3 font-medium shadow-lg">{activeItem.title}</Card>
        )}
      </DragOverlay>
    </DndContext>
  )
}
