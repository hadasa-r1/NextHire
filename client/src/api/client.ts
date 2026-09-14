export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; file?: File; signal?: AbortSignal };

// One transport for all resources. Authentication transport will be supplied by Group C.
export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (options.file && options.body !== undefined) throw new Error("Use either a file or a JSON body.");
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.file ? { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(options.file.name) }
          : options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(options.file ? { body: options.file } : options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (cause) {
    if (options.signal?.aborted || (cause instanceof Error && cause.name === "AbortError")) throw cause;
    throw new ApiError(0, "לא ניתן להתחבר לשרת. נא לנסות שוב.");
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, readMessage(body, response.status));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, signal ? { signal } : {});
}

function readMessage(body: unknown, status: number): string {
  if (status === 401) return "נדרשת התחברות למערכת.";
  if (status === 403) return "אין לך הרשאה לביצוע פעולה זו.";
  if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string") return body.message;
  return "הבקשה נכשלה. נא לנסות שוב.";
}

