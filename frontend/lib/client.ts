export class ApiError extends Error {
  status: number;
  code: string;
  fields: { field: string; message: string }[];

  constructor(message: string, status: number, code = "request_failed", fields: { field: string; message: string }[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = readCookie("eventora_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const response = await fetch(`/api/backend${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string; fields?: { field: string; message: string }[] } })
      ?.error;
    throw new ApiError(
      error?.message ?? "Something went wrong. Please try again.",
      response.status,
      error?.code ?? "request_failed",
      error?.fields ?? [],
    );
  }

  return payload as T;
}
