import { db } from "../drizzle/db";
import {
  mealPlan,
  mealPlanDay,
  mealPlanEntry,
  type NewMealPlan,
  type NewMealPlanDay,
  type NewMealPlanEntry,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { CreateMealPlanCriteriaInput } from "../validators/meal";
import type { GeminiMealPlanResponse, GeminiMealPlanDayEntry } from "./gemini";

type UUID = string;

function createId(): UUID {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID (should not happen in Bun)
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  ).toUpperCase();
}

export async function saveMealPlan(
  userId: string,
  input: CreateMealPlanCriteriaInput,
  modelPlan: GeminiMealPlanResponse,
): Promise<{ planId: string }> {
  const planId = createId();

  const queries: unknown[] = [];

  const newPlan: NewMealPlan = {
    id: planId,
    userId,
    title: input.title,
    cuisine: input.cuisine,
    spiceLevel: input.spiceLevel,
    medicalConditions: input.medicalConditions ?? [],
    pantryItemsSnapshot: input.pantryItemsSnapshot ?? [],
    planType: input.planType,
  };

  queries.push(db.insert(mealPlan).values(newPlan));

  for (const day of modelPlan.days) {
    const dayId = createId();

    const newDay: NewMealPlanDay = {
      id: dayId,
      planId,
      date: null,
      dayIndex: day.dayIndex,
      summary: day.summary,
    };

    queries.push(db.insert(mealPlanDay).values(newDay));

    const entries: NewMealPlanEntry[] = day.entries.map((entry, index) => ({
      id: createId(),
      planDayId: dayId,
      mealSlot: entry.mealSlot,
      position: entry.position ?? index,
      title: entry.title,
      description: entry.description ?? null,
      searchKeyword: entry.searchKeyword,
      imageUrl: entry.imageUrl ?? null,
      cookingTime: entry.cookingTime ?? null,
      difficulty: entry.difficulty,
      instructions:
        entry.instructions && entry.instructions.length > 0
          ? entry.instructions
          : null,
      ingredients:
        entry.ingredients && entry.ingredients.length > 0
          ? entry.ingredients
          : null,
      servings:
        typeof entry.servings === "number" ? entry.servings : null,
      calories:
        typeof entry.calories === "number" ? entry.calories : null,
      protein:
        typeof entry.protein === "number" ? entry.protein : null,
      carbs: typeof entry.carbs === "number" ? entry.carbs : null,
      fat: typeof entry.fat === "number" ? entry.fat : null,
      weight: entry.weight ?? null,
    }));

    if (entries.length > 0) {
      queries.push(db.insert(mealPlanEntry).values(entries));
    }
  }

  await db.batch(queries as any);

  return { planId };
}

/** Update a single meal plan entry in place (same id). Used when user replaces one meal via AI. */
export async function replaceMealPlanEntry(
  entryId: string,
  newEntry: GeminiMealPlanDayEntry,
): Promise<void> {
  await db
    .update(mealPlanEntry)
    .set({
      mealSlot: newEntry.mealSlot,
      position: newEntry.position,
      title: newEntry.title,
      description: newEntry.description ?? null,
      searchKeyword: newEntry.searchKeyword,
      imageUrl: newEntry.imageUrl ?? null,
      cookingTime: newEntry.cookingTime ?? null,
      difficulty: newEntry.difficulty,
      instructions:
        newEntry.instructions && newEntry.instructions.length > 0
          ? newEntry.instructions
          : null,
      ingredients:
        newEntry.ingredients && newEntry.ingredients.length > 0
          ? newEntry.ingredients
          : null,
      servings: typeof newEntry.servings === "number" ? newEntry.servings : null,
      calories: typeof newEntry.calories === "number" ? newEntry.calories : null,
      protein: typeof newEntry.protein === "number" ? newEntry.protein : null,
      carbs: typeof newEntry.carbs === "number" ? newEntry.carbs : null,
      fat: typeof newEntry.fat === "number" ? newEntry.fat : null,
      weight: newEntry.weight ?? null,
    })
    .where(eq(mealPlanEntry.id, entryId));
}

