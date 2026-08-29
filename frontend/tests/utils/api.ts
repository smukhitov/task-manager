// Direct API access for setting up states the UI cannot reach on its own —
// notably deleting a record behind the back of a page that is still showing it.
import { ItemsService, LoginService, UsersService } from "../../src/client"
import { client } from "../../src/client/client.gen"
import { firstSuperuser, firstSuperuserPassword } from "../config.ts"

client.setConfig({
  baseURL: `${process.env.VITE_API_URL}`,
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

export const getAccessToken = async ({
  email,
  password,
}: {
  email: string
  password: string
}) => {
  const response = await LoginService.loginAccessToken({
    body: { username: email, password },
  })
  return response.data.access_token
}

export const deleteUserAsSuperuser = async (userId: string) => {
  const token = await getAccessToken({
    email: firstSuperuser,
    password: firstSuperuserPassword,
  })
  await UsersService.deleteUser({
    path: { user_id: userId },
    headers: bearer(token),
  })
}

export const createItem = async ({
  token,
  title,
}: {
  token: string
  title: string
}) => {
  const response = await ItemsService.createItem({
    body: { title },
    headers: bearer(token),
  })
  return response.data
}

export const deleteItem = async ({
  token,
  itemId,
}: {
  token: string
  itemId: string
}) => {
  await ItemsService.deleteItem({
    path: { id: itemId },
    headers: bearer(token),
  })
}
