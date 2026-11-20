/**
 * Thin client for the `equipmen-backend` API. The store application holds no
 * data of its own: every read and write goes through here.
 */

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "")

export class ApiFailure extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiFailure"
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  token?: string | null
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    })
  } catch {
    throw new ApiFailure(0, "Cannot reach the store server. Start the backend and try again.")
  }

  const payload = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & { ok?: boolean; message?: string })
    | null

  if (!response.ok || payload?.ok !== true) {
    throw new ApiFailure(
      response.status,
      payload?.message ?? "The store server rejected that. Try again.",
    )
  }

  return payload as T
}
