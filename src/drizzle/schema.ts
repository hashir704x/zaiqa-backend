import { InferInsertModel, InferSelectModel, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";

// start of better auth tables schema
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
// end of better auth tables schema

// start of meal planner tables schema

export const cuisineEnum = pgEnum("cuisine", [
  "desi",
  "western",
  "arabic",
  "pan_asian",
]);

export const spiceLevelEnum = pgEnum("spice_level", [
  "low",
  "medium",
  "high",
  "extra_hot",
]);

export const planTypeEnum = pgEnum("plan_type", [
  "instant",
  "one_day",
  "three_day",
  "week",
]);

export const mealSlotEnum = pgEnum("meal_slot", [
  "breakfast",
  "lunch",
  "dinner",
]);

export const difficultyEnum = pgEnum("difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const mealPlan = pgTable("meal_plan", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  cuisine: cuisineEnum("cuisine").notNull(),
  spiceLevel: spiceLevelEnum("spice_level").notNull(),
  medicalConditions: text("medical_conditions").array(),
  pantryItemsSnapshot: text("pantry_items_snapshot").array(),
  planType: planTypeEnum("plan_type").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const mealPlanDay = pgTable("meal_plan_day", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => mealPlan.id, { onDelete: "cascade" }),

  date: date("date"),
  dayIndex: integer("day_index").notNull(),
  summary: text("summary"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const mealPlanEntry = pgTable("meal_plan_entry", {
  id: text("id").primaryKey(),
  planDayId: text("plan_day_id")
    .notNull()
    .references(() => mealPlanDay.id, { onDelete: "cascade" }),

  mealSlot: mealSlotEnum("meal_slot").notNull(),
  position: integer("position").notNull(),

  title: text("title").notNull(),
  description: text("description"),
  searchKeyword: text("search_keyword").notNull(),
  imageUrl: text("image_url"),
  cookingTime: text("cooking_time"),
  difficulty: difficultyEnum("difficulty").default("easy").notNull(),
  instructions: jsonb("instructions"),
  ingredients: jsonb("ingredients"),

  servings: integer("servings"),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  weight: text("weight"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const mealPlanRelations = relations(mealPlan, ({ one, many }) => ({
  user: one(user, {
    fields: [mealPlan.userId],
    references: [user.id],
  }),
  days: many(mealPlanDay),
}));

export const mealPlanDayRelations = relations(
  mealPlanDay,
  ({ one, many }) => ({
    plan: one(mealPlan, {
      fields: [mealPlanDay.planId],
      references: [mealPlan.id],
    }),
    entries: many(mealPlanEntry),
  }),
);

export const mealPlanEntryRelations = relations(mealPlanEntry, ({ one }) => ({
  day: one(mealPlanDay, {
    fields: [mealPlanEntry.planDayId],
    references: [mealPlanDay.id],
  }),
}));

// end of meal planner tables schema

// inferred types

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;

export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;

export type MealPlan = InferSelectModel<typeof mealPlan>;
export type NewMealPlan = InferInsertModel<typeof mealPlan>;

export type MealPlanDay = InferSelectModel<typeof mealPlanDay>;
export type NewMealPlanDay = InferInsertModel<typeof mealPlanDay>;

export type MealPlanEntry = InferSelectModel<typeof mealPlanEntry>;
export type NewMealPlanEntry = InferInsertModel<typeof mealPlanEntry>;