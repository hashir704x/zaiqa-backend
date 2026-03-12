import type { Context } from "hono";
import { eq, inArray, desc, asc, and } from "drizzle-orm";
import { db } from "../drizzle/db";
import {
  mealPlan,
  mealPlanDay,
  mealPlanEntry,
  type MealPlan,
  type MealPlanDay,
  type MealPlanEntry,
} from "../drizzle/schema";
import {
  CreateMealPlanCriteriaSchema,
  type CreateMealPlanCriteriaInput,
} from "../validators/meal";
import { generateMealPlanWithGemini, generateSingleMealEntryWithGemini } from "../services/gemini";
import { saveMealPlan, replaceMealPlanEntry } from "../services/meal.service";

export async function createMealPlanController(c: Context) {
  const user = c.get("user") as { id: string };

  let body: unknown;
  try {
    body = await c.req.json();
   
  } catch {
    return c.json(
      { error: "Invalid JSON", message: "Request body must be valid JSON." },
      400,
    );
  }

  const parseResult = CreateMealPlanCriteriaSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      {
        error: "Invalid request body",
        details: parseResult.error.issues[0].message,
      },
      400,
    );
  }

  const input: CreateMealPlanCriteriaInput = parseResult.data;

  try {
    const modelPlan = await generateMealPlanWithGemini(input);

    const { planId } = await saveMealPlan(user.id, input, modelPlan);

    const id = planId;

    const plans = await db
      .select()
      .from(mealPlan)
      .where(and(eq(mealPlan.id, id), eq(mealPlan.userId, user.id)));

    const plan = plans[0] as MealPlan | undefined;

    if (!plan) {
      return c.json({ error: "Meal Not Found" }, 404);
    }

    const days = (await db
      .select()
      .from(mealPlanDay)
      .where(eq(mealPlanDay.planId, plan.id))
      .orderBy(asc(mealPlanDay.dayIndex))) as MealPlanDay[];

    const dayIds = days.map((d) => d.id);

    let entries: MealPlanEntry[] = [];

    if (dayIds.length > 0) {
      entries = (await db
        .select()
        .from(mealPlanEntry)
        .where(inArray(mealPlanEntry.planDayId, dayIds))
        .orderBy(
          asc(mealPlanEntry.mealSlot),
          asc(mealPlanEntry.position),
        )) as MealPlanEntry[];
    }

    const daysWithEntries = days.map((day) => ({
      ...day,
      entries: entries.filter((entry) => entry.planDayId === day.id),
    }));

    return c.json(
      {
        plan,
        days: daysWithEntries,
      },
      201,
    );
  } catch (error) {
    console.error("Error creating meal plan with Gemini:", error);

    return c.json(
      {
        error: "MEAL_PLAN_GENERATION_FAILED",
        message:
          "Failed to generate meal plan. Please try again later.",
      },
      500,
    );
  }
}

export async function listMealPlansController(c: Context) {
  const user = c.get("user") as { id: string };

  console.log("id:", user.id);

  const plans = await db
    .select()
    .from(mealPlan)
    .where(eq(mealPlan.userId, user.id))
    .orderBy(desc(mealPlan.createdAt));

  return c.json({
    plans: plans.map((p) => ({
      id: p.id,
      title: p.title,
      planType: p.planType,
      cuisine: p.cuisine,
      spiceLevel: p.spiceLevel,
      createdAt: p.createdAt,
    })),
  });
}

export async function getMealPlanController(c: Context) {
  const user = c.get("user") as { id: string };

  const id = c.req.param("id") as string;

  const plans = await db
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.id, id), eq(mealPlan.userId, user.id)));

  const plan = plans[0] as MealPlan | undefined;

  if (!plan) {
    return c.json({ error: "Meal Not Found" }, 404);
  }

  const days = (await db
    .select()
    .from(mealPlanDay)
    .where(eq(mealPlanDay.planId, plan.id))
    .orderBy(asc(mealPlanDay.dayIndex))) as MealPlanDay[];

  const dayIds = days.map((d) => d.id);

  let entries: MealPlanEntry[] = [];

  if (dayIds.length > 0) {
    entries = (await db
      .select()
      .from(mealPlanEntry)
      .where(inArray(mealPlanEntry.planDayId, dayIds))
      .orderBy(
        asc(mealPlanEntry.mealSlot),
        asc(mealPlanEntry.position),
      )) as MealPlanEntry[];
  }

  const daysWithEntries = days.map((day) => ({
    ...day,
    entries: entries.filter((entry) => entry.planDayId === day.id),
  }));

  return c.json({
    plan,
    days: daysWithEntries,
  });
}

export async function deleteMealPlanController(c: Context) {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id") as string;

  const plans = await db
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.id, id), eq(mealPlan.userId, user.id)));

  const plan = plans[0] as MealPlan | undefined;

  if (!plan) {
    return c.json({ error: "Meal Not Found" }, 404);
  }

  await db.delete(mealPlan).where(eq(mealPlan.id, id));

  return c.body(null, 204);
}

export async function replaceMealPlanEntryController(c: Context) {
  const user = c.get("user") as { id: string };
  const planId = c.req.param("planId") as string;
  const entryId = c.req.param("entryId") as string;


  const plans = await db
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.id, planId), eq(mealPlan.userId, user.id)));

  const plan = plans[0] as MealPlan | undefined;
  if (!plan) {
    return c.json({ error: "Meal Not Found" }, 404);
  }

  const entries = await db
    .select()
    .from(mealPlanEntry)
    .where(eq(mealPlanEntry.id, entryId));

  const entry = entries[0] as MealPlanEntry | undefined;
  if (!entry) {
    return c.json({ error: "Entry Not Found" }, 404);
  }

  const days = await db
    .select()
    .from(mealPlanDay)
    .where(eq(mealPlanDay.id, entry.planDayId));

  const day = days[0];
  if (!day || day.planId !== plan.id) {
    return c.json({ error: "Entry Not Found" }, 404);
  }

  const sameDayEntries = await db
    .select({ title: mealPlanEntry.title })
    .from(mealPlanEntry)
    .where(eq(mealPlanEntry.planDayId, entry.planDayId));

  const avoidTitles = sameDayEntries
    .map((e) => e.title)
    .filter((t) => t !== entry.title);

  try {
    const generated = await generateSingleMealEntryWithGemini({
      cuisine: plan.cuisine,
      spiceLevel: plan.spiceLevel,
      medicalConditions: plan.medicalConditions ?? null,
      pantryItemsSnapshot: plan.pantryItemsSnapshot ?? null,
      mealSlot: entry.mealSlot,
      position: entry.position,
      avoidTitles,
    });

    await replaceMealPlanEntry(entryId, generated);

    const updated = await db
      .select()
      .from(mealPlanEntry)
      .where(eq(mealPlanEntry.id, entryId));

    const updatedEntry = updated[0] as MealPlanEntry;
    return c.json({ entry: updatedEntry }, 200);
  } catch (err) {
    console.error("Error replacing meal plan entry:", err);
    return c.json(
      {
        error: "ENTRY_REPLACEMENT_FAILED",
        message: "Failed to generate a replacement meal. Please try again.",
      },
      500,
    );
  }
}
