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
import { useMemo, useRef, useState } from "react"

import {
  type ItemPublic,
  type ItemStatus,
  ItemsService,
  type SortDirection,
} from "@/client"
import { Card } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { BoardColumn } from "./BoardColumn"
import { BoardSortMenu } from "./BoardSortMenu"
import { BOARD_COLUMNS, isItemStatus } from "./columns"

type Columns = Record<ItemStatus, ItemPublic[]>

interface MoveVariables {
  id: string
  target_status: ItemStatus
  target_index: number
}

interface SortVariables {
  status: ItemStatus
  direction: SortDirection
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
  // Read from the mutation's async callbacks, which close over a stale render.
  const activeIdRef = useRef<string | null>(null)
  // Where the card sat when this drag began — what a no-op drop is judged against.
  const originColumnsRef = useRef<Columns | null>(null)

  const columns = dragColumns ?? serverColumns

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Hand back to the server's arrangement only once it has been refetched, so
  // a card never flickers into its old slot in between. On failure this is
  // what snaps the board back. A drag started while the refetch was in flight
  // owns the arrangement now, so leave it alone.
  const releaseToServerArrangement = async () => {
    await queryClient.invalidateQueries({ queryKey: ["items"] })
    if (activeIdRef.current === null) {
      setDragColumns(null)
    }
  }

  const moveMutation = useMutation({
    mutationFn: ({ id, target_status, target_index }: MoveVariables) =>
      ItemsService.moveItem({
        path: { id },
        body: { target_status, target_index },
      }),
    onError: handleError.bind(showErrorToast),
    onSettled: releaseToServerArrangement,
  })

  // Renumbering a column by `created_at` rewrites its stored `position`
  // values, so the new order survives a reload and a later drag overrides it.
  const sortMutation = useMutation({
    mutationFn: ({ status, direction }: SortVariables) =>
      ItemsService.sortItems({ body: { status, direction } }),
    onError: handleError.bind(showErrorToast),
    onSettled: releaseToServerArrangement,
  })

  const activeItem =
    activeId === null
      ? null
      : (Object.values(columns)
          .flat()
          .find((item) => item.id === activeId) ?? null)

  const handleDragStart = ({ active }: DragStartEvent) => {
    activeIdRef.current = String(active.id)
    setActiveId(String(active.id))
    // Start from what is on screen. While an earlier move is still being
    // refetched, `serverColumns` is one move behind, so reusing it here would
    // snap the card back to where it was before that move.
    const base =
      moveMutation.isPending && dragColumns ? dragColumns : serverColumns
    originColumnsRef.current = base
    setDragColumns(base)
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
    const origins = originColumnsRef.current ?? serverColumns
    activeIdRef.current = null
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
    // Dropping on a card targets that card's slot. Dropping on the column
    // background keeps the card where the drag already put it — appending only
    // if it is not in this column yet.
    const targetIndex =
      overIndex !== -1
        ? overIndex
        : fromIndex !== -1
          ? fromIndex
          : working[targetStatus].length

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

    const origin = findColumn(origins, id)
    const originIndex = origin
      ? origins[origin].findIndex((item) => item.id === id)
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
        activeIdRef.current = null
        setActiveId(null)
        setDragColumns(null)
      }}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {BOARD_COLUMNS.map(({ status, title }) => (
          <BoardColumn
            key={status}
            status={status}
            activeId={activeId}
            title={title}
            items={columns[status]}
            action={
              <BoardSortMenu
                title={title}
                // Sorting mid-drag would renumber the column under the
                // card being moved, so the control is closed off until the
                // drop — and until this column's own sort has come back.
                disabled={
                  activeId !== null ||
                  (sortMutation.isPending &&
                    sortMutation.variables.status === status)
                }
                onSort={(direction) =>
                  sortMutation.mutate({ status, direction })
                }
              />
            }
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
