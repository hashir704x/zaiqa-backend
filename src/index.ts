import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import mealRoutes from "./routes/meal.routes";

const app = new Hono();

app.use(logger());

if (!process.env.FRONTEND_URL) {
  throw new Error("Failed to load frontend url");
}

app.use(
  "/api/*",
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api/meal-plans", mealRoutes);

app.get("/", (c) => {
  return c.text("Hello Hono!!");
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
