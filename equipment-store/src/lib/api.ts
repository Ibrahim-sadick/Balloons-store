/**
 * Thin client for the `equipmen-backend` API. The store application holds no
 * data of its own: every read and write goes through here.
 */

const API_PORT = 4000

/**
 * Which server to talk to. `NEXT_PUBLIC_API_URL` wins when set (a real deploy).
 * Otherwise mirror the host that served the page and swap only the port: opened
 * from a phone, "localhost" means the phone itself, so a baked-in
 * http://localhost:4000 refuses every call even when the desk PC is running.
 */
export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")
  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
  }
  return `http://localhost:${API_PORT}`
}

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
    response = await fetch(`${apiBaseUrl()}${path}`, {
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
