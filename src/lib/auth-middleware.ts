import type { Context, Next } from "hono";
import type { User } from "../drizzle/schema";
import { auth } from "./auth";

type UserFromSession = User;

export async function requireAuth(
  c: Context,
  next: Next,
): Promise<Response | void> {
  const sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!sessionResult) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", sessionResult.user as UserFromSession);
  c.set("session", sessionResult.session);

  return next();
}
