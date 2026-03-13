import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../drizzle/db";
import * as schema from "../drizzle/schema";

if (!process.env.FRONTEND_URL) {
  throw new Error("Failed to load frontend url");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [process.env.FRONTEND_URL],
  advanced: {
    useSecureCookies: true,
    defaultCookieAttributes: { sameSite: "none", secure: true, httpOnly: true },
  },
});
