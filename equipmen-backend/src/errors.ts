/** An error that carries the HTTP status the client should see. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export const badRequest = (message: string) => new ApiError(400, message)
export const unauthorized = (message: string) => new ApiError(401, message)
export const forbidden = (message: string) => new ApiError(403, message)
export const notFound = (message: string) => new ApiError(404, message)
export const conflict = (message: string) => new ApiError(409, message)
