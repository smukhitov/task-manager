// Single owner of the generated client's configuration for tests. The client is
// a shared singleton, so every test helper that talks to the API imports this
// rather than calling setConfig itself.
import { client } from "../../src/client/client.gen"

client.setConfig({
  baseURL: `${process.env.VITE_API_URL}`,
})

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
