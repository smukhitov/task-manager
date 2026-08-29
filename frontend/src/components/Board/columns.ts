import type { ItemStatus } from "@/client"

export interface BoardColumnDef {
  status: ItemStatus
  title: string
}

/** The three fixed board columns, in display order. */
export const BOARD_COLUMNS: BoardColumnDef[] = [
  { status: "todo", title: "Todo" },
  { status: "in_progress", title: "In Progress" },
  { status: "completed", title: "Completed" },
]

export const isItemStatus = (value: string): value is ItemStatus =>
  BOARD_COLUMNS.some((column) => column.status === value)
