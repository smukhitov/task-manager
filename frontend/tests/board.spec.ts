import { expect, type Page, test } from "@playwright/test"
import { createUser } from "./utils/privateApi"
import { randomEmail, randomItemTitle, randomPassword } from "./utils/random"
import { logInUser } from "./utils/user"

type ColumnStatus = "todo" | "in_progress" | "completed"

const column = (page: Page, status: ColumnStatus) =>
  page.getByTestId(`board-column-${status}`)

/** The card titles in one column, top to bottom. */
async function columnTitles(page: Page, status: ColumnStatus) {
  const cards = column(page, status).getByTestId("board-card")
  return (await cards.allInnerTexts()).map((text) => text.split("\n")[0].trim())
}

/**
 * dnd-kit applies each keyboard move on an animation frame and re-measures the
 * droppables afterwards, so the next key must wait for that to land — pressing
 * back-to-back drops the intermediate moves.
 */
async function pressAndSettle(page: Page, key: string) {
  await page.keyboard.press(key)
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
}

/**
 * Move a card with the keyboard.
 *
 * dnd-kit's KeyboardSensor drives the same drag pipeline as the pointer, so
 * this exercises the real move path without simulating pixel-level drags.
 */
async function moveCard(page: Page, title: string, keys: string[]) {
  await page.getByRole("button", { name: `Drag ${title}` }).focus()
  await pressAndSettle(page, "Space")
  for (const key of keys) {
    await pressAndSettle(page, key)
  }
  await pressAndSettle(page, "Space")
}

const COLUMN_TITLES: Record<ColumnStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  completed: "Completed",
}

/**
 * The given titles in the order they appear in a column, ignoring any other
 * cards. The board user is shared across the tests in this file, so a column
 * can hold leftovers from earlier ones.
 */
async function orderOf(page: Page, status: ColumnStatus, titles: string[]) {
  const present = await columnTitles(page, status)
  return present.filter((title) => titles.includes(title))
}

/** Pick a sort direction from a column's sort control. */
async function sortColumn(
  page: Page,
  status: ColumnStatus,
  label: "Newest first" | "Oldest first",
) {
  await column(page, status)
    .getByRole("button", { name: `Sort ${COLUMN_TITLES[status]}` })
    .click()
  await page.getByRole("menuitem", { name: label }).click()
}

async function addItem(page: Page, title: string) {
  await page.getByRole("button", { name: "Add Item" }).click()
  await page.getByLabel("Title").fill(title)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Item created successfully")).toBeVisible()
  await expect(page.getByText("Item created successfully")).not.toBeVisible({
    timeout: 15000,
  })
}

test("Board page is accessible and shows three columns", async ({ page }) => {
  await page.goto("/board")

  await expect(page.getByRole("heading", { name: "Board" })).toBeVisible()
  await expect(column(page, "todo")).toBeVisible()
  await expect(column(page, "in_progress")).toBeVisible()
  await expect(column(page, "completed")).toBeVisible()
})

test.describe("Board", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  let email: string
  const password = randomPassword()
  const first = randomItemTitle()
  const second = randomItemTitle()

  test.beforeAll(async () => {
    email = randomEmail()
    await createUser({ email, password })
  })

  test.beforeEach(async ({ page }) => {
    await logInUser(page, email, password)
    await page.goto("/board")
  })

  test("New items land in Todo", async ({ page }) => {
    await addItem(page, first)
    await addItem(page, second)

    await expect(column(page, "todo").getByText(first)).toBeVisible()
    await expect(column(page, "todo").getByText(second)).toBeVisible()
    expect(await columnTitles(page, "in_progress")).toEqual([])
    expect(await columnTitles(page, "completed")).toEqual([])
  })

  test("Dragging a card to another column persists across reload", async ({
    page,
  }) => {
    const title = randomItemTitle()
    await addItem(page, title)
    await expect(column(page, "todo").getByText(title)).toBeVisible()

    await moveCard(page, title, ["ArrowRight"])

    await expect(column(page, "in_progress").getByText(title)).toBeVisible()

    await page.reload()
    await expect(column(page, "in_progress").getByText(title)).toBeVisible()
    await expect(column(page, "todo").getByText(title)).not.toBeVisible()
  })

  test("A card can be dragged back from Completed to Todo", async ({
    page,
  }) => {
    const title = randomItemTitle()
    await addItem(page, title)

    await moveCard(page, title, ["ArrowRight", "ArrowRight"])
    await expect(column(page, "completed").getByText(title)).toBeVisible()

    await moveCard(page, title, ["ArrowLeft", "ArrowLeft"])
    await expect(column(page, "todo").getByText(title)).toBeVisible()

    await page.reload()
    await expect(column(page, "todo").getByText(title)).toBeVisible()
  })

  test("Reordering within a column persists across reload", async ({
    page,
  }) => {
    const top = randomItemTitle()
    const bottom = randomItemTitle()
    await addItem(page, top)
    await addItem(page, bottom)

    const before = await columnTitles(page, "todo")
    expect(before.slice(-2)).toEqual([top, bottom])

    await moveCard(page, top, ["ArrowDown"])

    await expect
      .poll(async () => (await columnTitles(page, "todo")).slice(-2))
      .toEqual([bottom, top])

    await page.reload()
    await expect
      .poll(async () => (await columnTitles(page, "todo")).slice(-2))
      .toEqual([bottom, top])
  })

  test("Sorting a column reorders it and the order persists across reload", async ({
    page,
  }) => {
    const older = randomItemTitle()
    const newer = randomItemTitle()
    await addItem(page, older)
    await addItem(page, newer)

    // New items append to the end of Todo, so creation order is the start.
    expect(await orderOf(page, "todo", [older, newer])).toEqual([older, newer])

    await sortColumn(page, "todo", "Newest first")
    await expect
      .poll(() => orderOf(page, "todo", [older, newer]))
      .toEqual([newer, older])

    // The sort rewrote stored positions, so a reload shows the same order.
    await page.reload()
    await expect
      .poll(() => orderOf(page, "todo", [older, newer]))
      .toEqual([newer, older])

    await sortColumn(page, "todo", "Oldest first")
    await expect
      .poll(() => orderOf(page, "todo", [older, newer]))
      .toEqual([older, newer])

    await page.reload()
    await expect
      .poll(() => orderOf(page, "todo", [older, newer]))
      .toEqual([older, newer])
  })

  test("Dragging a card after a sort overrides the sorted order", async ({
    page,
  }) => {
    const older = randomItemTitle()
    const newer = randomItemTitle()
    await addItem(page, older)
    await addItem(page, newer)

    await sortColumn(page, "todo", "Newest first")
    await expect
      .poll(() => orderOf(page, "todo", [older, newer]))
      .toEqual([newer, older])

    // Newest-first puts these two at the top of the column, so one step down
    // swaps them.
    await moveCard(page, newer, ["ArrowDown"])
    await expect
      .poll(() => orderOf(page, "todo", [older, newer]))
      .toEqual([older, newer])

    await page.reload()
    await expect
      .poll(() => orderOf(page, "todo", [older, newer]))
      .toEqual([older, newer])
  })
})
