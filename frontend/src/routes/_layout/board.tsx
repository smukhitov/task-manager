import { createFileRoute } from "@tanstack/react-router"

import { Board } from "@/components/Board/Board"
import AddItem from "@/components/Items/AddItem"

export const Route = createFileRoute("/_layout/board")({
  component: BoardPage,
  head: () => ({
    meta: [
      {
        title: "Board - FastAPI Template",
      },
    ],
  }),
})

function BoardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Board</h1>
          <p className="text-muted-foreground">
            Drag your items between Todo, In Progress and Completed
          </p>
        </div>
        <AddItem />
      </div>
      <Board />
    </div>
  )
}
