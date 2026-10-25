import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a route handler with the session check and turns thrown errors into JSON responses. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response | object | void>) {
  return async (...args: Args): Promise<Response> => {
    if (!(await isSignedIn())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    try {
      const result = await fn(...args);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 400;
      const message = err instanceof Error ? err.message : "Something went wrong.";
      if (!(err instanceof HttpError)) console.error("[api]", err);
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found.");
  return id;
}
