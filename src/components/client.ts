"use client";

/** fetch wrapper for our JSON API: throws an Error with the server's message on failure. */
export async function api<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; json?: unknown; form?: FormData } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.json || opts.form ? "POST" : "GET"),
    headers: opts.json ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.json ? JSON.stringify(opts.json) : undefined),
  });
  const body = await res.json().catch(() => ({}));
  // Full reload on purpose: the session is gone, so drop all client state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (res.status === 401) window.location.href = "/login";
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");
