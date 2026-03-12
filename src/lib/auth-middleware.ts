import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../drizzle/db";
import { session, user, type User } from "../drizzle/schema";
import { getSessionCookieName } from "./auth";

type UserFromSession = User;

export async function requireAuth(
  c: Context,
  next: Next,
): Promise<Response | void> {
  const cookieName = getSessionCookieName();
  const token = getCookie(c, cookieName);

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const now = new Date();

  const sessions = await db
    .select()
    .from(session)
    .where(
      and(eq(session.token, token), gt(session.expiresAt, now)),
    );

  const currentSession = sessions[0];

  if (!currentSession) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, currentSession.userId));

  const currentUser = users[0] as User | undefined;

  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", currentUser as UserFromSession);
  c.set("session", currentSession);

  return next();
}
