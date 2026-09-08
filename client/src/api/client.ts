// Minimal read-only client for the Group B API. In dev, Vite proxies /api to
// http://127.0.0.1:3000 (see vite.config.ts), so paths here stay relative.
//
// This screen only reads. Write operations (the "פעולה" buttons) belong to the
// destination screens and are not implemented here — see CandidatePoolPage.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new ApiError(0, "לא ניתן להתחבר לשרת. ודאו שה־API פועל.");
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, readMessage(body, response.status));
  }

  return response.json() as Promise<T>;
}

function readMessage(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return `הבקשה נכשלה (${status}).`;
}
