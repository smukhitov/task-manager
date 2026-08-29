// Note: the `PrivateService` is only available when generating the client
// for local environments
import { PrivateService } from "../../src/client"
import "./client"

export const createUser = async ({
  email,
  password,
}: {
  email: string
  password: string
}) => {
  const response = await PrivateService.createUser({
    body: {
      email,
      password,
      is_verified: true,
      full_name: "Test User",
    },
  })
  return response.data
}
