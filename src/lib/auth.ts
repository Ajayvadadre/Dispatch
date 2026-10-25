import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "dispatch_session";

export const authEnabled = () => Boolean(env.adminPassword);

/** The session value is derived from the password, so changing ADMIN_PASSWORD signs everyone out. */
function sessionValue() {
  return crypto.createHmac("sha256", env.sessionSecret).update(`admin:${env.adminPassword}`).digest("hex");
}

export function checkPassword(input: string) {
  const a = Buffer.from(crypto.createHash("sha256").update(input).digest("hex"));
  const b = Buffer.from(crypto.createHash("sha256").update(env.adminPassword).digest("hex"));
  return authEnabled() && crypto.timingSafeEqual(a, b);
}

export async function isSignedIn() {
  if (!authEnabled()) return true;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value === sessionValue();
}

export async function signIn() {
  (await cookies()).set(SESSION_COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requirePageSession() {
  if (!(await isSignedIn())) redirect("/login");
}
