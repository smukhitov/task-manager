import { expect, type Page, test } from "@playwright/test"
import {
  createItem,
  deleteItem,
  deleteUserAsSuperuser,
  getAccessToken,
} from "./utils/api"
import { createUser } from "./utils/privateApi"
import { randomEmail, randomItemTitle, randomPassword } from "./utils/random"
import { logInUser } from "./utils/user"

// These tests own their session, so they opt out of the shared stored auth state.
test.use({ storageState: { cookies: [], origins: [] } })

const storedToken = (page: Page) =>
  page.evaluate(() => localStorage.getItem("access_token"))

test("Deleting the signed-in account returns the user to login", async ({
  page,
}) => {
  const email = randomEmail()
  const password = randomPassword()
  const user = await createUser({ email, password })

  await logInUser(page, email, password)

  // The account disappears while the session is still live — an admin removing
  // it, or the user deleting it from another tab.
  await deleteUserAsSuperuser(user.id)

  await page.goto("/items")

  await page.waitForURL("/login")
  await expect(storedToken(page)).resolves.toBeNull()
  await expect(page.getByTestId("email-input")).toBeVisible()
})

test("A missing item does not end the session", async ({ page }) => {
  const email = randomEmail()
  const password = randomPassword()
  await createUser({ email, password })
  const token = await getAccessToken({ email, password })

  const title = randomItemTitle()
  const item = await createItem({ token, title })

  await logInUser(page, email, password)
  await page.goto("/items")
  await expect(page.getByText(title)).toBeVisible()

  // Remove the item behind the page's back, so the delete below hits a 404.
  await deleteItem({ token, itemId: item.id })

  const itemRow = page.getByRole("row").filter({ hasText: title })
  await itemRow.getByRole("button").last().click()
  await page.getByRole("menuitem", { name: "Delete Item" }).click()
  await page.getByRole("button", { name: "Delete" }).click()

  // The 404 is an ordinary page-level error, not a reason to sign the user out.
  await expect(page.getByText("Item not found")).toBeVisible()
  await expect(page).toHaveURL(/\/items$/)
  await expect(storedToken(page)).resolves.not.toBeNull()
})
