import type { Context } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../drizzle/db";
import { user, session, type User } from "../drizzle/schema";
import {
  RegisterSchema,
  type RegisterInput,
  LoginSchema,
  type LoginInput,
} from "../validators/auth";
import {
  generateSessionToken,
  getSessionCookieName,
  hashPassword,
  verifyPassword,
} from "../lib/auth";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? "7");

function createExpiryDate(): Date {
  const now = new Date();
  now.setDate(now.getDate() + SESSION_TTL_DAYS);
  return now;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function createUserId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  ).toUpperCase();
}

async function createSessionForUser(
  c: Context,
  u: User,
): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = createExpiryDate();

  await db.insert(session).values({
    id: generateSessionToken(),
    token,
    userId: u.id,
    expiresAt,
    ipAddress: c.req.header("x-forwarded-for") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined,
  });

  const cookieName = getSessionCookieName();

  setCookie(c, cookieName, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function registerController(c: Context) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: "Invalid JSON", message: "Request body must be valid JSON." },
      400,
    );
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid request body",
        details: parsed.error.issues[0].message,
      },
      400,
    );
  }

  const input: RegisterInput = parsed.data;

  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, input.email.toLowerCase()));

  if (existingUsers.length > 0) {
    return c.json(
      {
        error: "EMAIL_TAKEN",
        message: "A user with this email already exists.",
      },
      409,
    );
  }

  const passwordHash = await hashPassword(input.password);

  const newUser: User = {
    id: createUserId(),
    name: input.name,
    email: input.email.toLowerCase(),
    emailVerified: false,
    image: null,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(user).values(newUser);

  await createSessionForUser(c, newUser);

  return c.json(
    {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    },
    201,
  );
}

export async function loginController(c: Context) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: "Invalid JSON", message: "Request body must be valid JSON." },
      400,
    );
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid request body",
        details: parsed.error.issues[0].message,
      },
      400,
    );
  }

  const input: LoginInput = parsed.data;

  const users = await db
    .select()
    .from(user)
    .where(eq(user.email, input.email.toLowerCase()));

  const found = users[0] as User | undefined;

  if (!found || !found.passwordHash) {
    return c.json(
      { error: "INVALID_CREDENTIALS", message: "Invalid email or password." },
      401,
    );
  }

  const ok = await verifyPassword(input.password, found.passwordHash);
  if (!ok) {
    return c.json(
      { error: "INVALID_CREDENTIALS", message: "Invalid email or password." },
      401,
    );
  }

  await createSessionForUser(c, found);

  return c.json({
    user: {
      id: found.id,
      name: found.name,
      email: found.email,
    },
  });
}

export async function logoutController(c: Context) {
  const cookieName = getSessionCookieName();
  const token = getCookie(c, cookieName);

  if (token) {
    await db.delete(session).where(eq(session.token, token));

    setCookie(c, cookieName, "", {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "Lax",
      path: "/",
      maxAge: 0,
    });
  }

  return c.body(null, 204);
}

