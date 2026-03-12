import "dotenv/config";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { CreateMealPlanCriteriaInput } from "../validators/meal";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in the environment");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const mealPlanResponseSchema = {
  type: SchemaType.OBJECT,
  description:
    "Meal plan broken down into days and meal entries that can be saved into the database.",
  properties: {
    days: {
      type: SchemaType.ARRAY,
      description: "List of days in the meal plan.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          dayIndex: {
            type: SchemaType.NUMBER,
            description:
              "Zero-based index of the day within the plan (0 for first day).",
          },
          summary: {
            type: SchemaType.STRING,
            description:
              "Short human-friendly summary of what the user will eat this day.",
          },
          entries: {
            type: SchemaType.ARRAY,
            description:
              "Meal entries for the day (e.g. breakfast, lunch, dinner).",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                mealSlot: {
                  type: SchemaType.STRING,
                  description:
                    "Which meal of the day this is: breakfast, lunch, or dinner.",
                  enum: ["breakfast", "lunch", "dinner"],
                },
                position: {
                  type: SchemaType.NUMBER,
                  description:
                    "Position of the meal within the slot (start at 0 and increment).",
                },
                title: {
                  type: SchemaType.STRING,
                  description: "Name of the dish or meal.",
                },
                description: {
                  type: SchemaType.STRING,
                  description:
                    "Short description explaining the dish and why it fits the user.",
                },
                searchKeyword: {
                  type: SchemaType.STRING,
                  description:
                    "Search keyword to find this recipe on the web (e.g. 'chicken karahi desi').",
                },
                imageUrl: {
                  type: SchemaType.STRING,
                  description:
                    "Representative image URL if you suggest one, otherwise leave empty string.",
                },
                cookingTime: {
                  type: SchemaType.STRING,
                  description:
                    "Approximate cooking time, e.g. '20 minutes', '45 minutes'.",
                },
                difficulty: {
                  type: SchemaType.STRING,
                  description:
                    "Difficulty of preparing the meal. Must be one of: easy, medium, hard.",
                  enum: ["easy", "medium", "hard"],
                },
                instructions: {
                  type: SchemaType.ARRAY,
                  description:
                    "Simple step-by-step cooking instructions. Each item is one step.",
                  items: { type: SchemaType.STRING },
                },
                ingredients: {
                  type: SchemaType.ARRAY,
                  description:
                    "List of ingredients with quantities and units for this meal.",
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      name: { type: SchemaType.STRING },
                      quantity: { type: SchemaType.STRING },
                      unit: { type: SchemaType.STRING },
                    },
                    required: ["name"],
                  },
                },
                servings: {
                  type: SchemaType.NUMBER,
                  description:
                    "Number of servings the recipe makes. Use 1 if unsure.",
                },
                calories: {
                  type: SchemaType.NUMBER,
                  description:
                    "Approximate total calories for this meal. Use a best-effort estimate.",
                },
                protein: {
                  type: SchemaType.NUMBER,
                  description:
                    "Approximate grams of protein in this meal. Use a best-effort estimate.",
                },
                carbs: {
                  type: SchemaType.NUMBER,
                  description:
                    "Approximate grams of carbohydrates in this meal. Use a best-effort estimate.",
                },
                fat: {
                  type: SchemaType.NUMBER,
                  description:
                    "Approximate grams of fat in this meal. Use a best-effort estimate.",
                },
                weight: {
                  type: SchemaType.STRING,
                  description:
                    "Approximate total cooked weight of the meal, e.g. '300g' or '1 bowl'.",
                },
              },
              required: [
                "mealSlot",
                "position",
                "title",
                "searchKeyword",
                "difficulty",
                "instructions",
                "ingredients",
              ],
            },
          },
        },
        required: ["dayIndex", "summary", "entries"],
      },
    },
  },
  required: ["days"],
} as const;

export type GeminiMealPlanDayEntry = {
  mealSlot: "breakfast" | "lunch" | "dinner";
  position: number;
  title: string;
  description?: string;
  searchKeyword: string;
  imageUrl?: string;
  cookingTime?: string;
  difficulty: "easy" | "medium" | "hard";
  instructions: string[];
  ingredients: {
    name: string;
    quantity?: string;
    unit?: string;
  }[];
  servings?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  weight?: string;
};

export type GeminiMealPlanDay = {
  dayIndex: number;
  summary: string;
  entries: GeminiMealPlanDayEntry[];
};

export type GeminiMealPlanResponse = {
  days: GeminiMealPlanDay[];
};

function buildPlanShapeInstruction(planType: CreateMealPlanCriteriaInput["planType"]): string {
  switch (planType) {
    case "instant":
      return "Create a single day (dayIndex 0) with exactly 1 meal entry that best matches the user's request.";
    case "one_day":
      return "Create a single day (dayIndex 0) with 3 entries: one for breakfast, one for lunch, and one for dinner.";
    case "three_day":
      return "Create exactly 3 days (dayIndex 0,1,2). For each day, include 3 entries: breakfast, lunch, and dinner.";
    case "week":
      return "Create exactly 7 days (dayIndex 0..6). For each day, include 3 entries: breakfast, lunch, and dinner.";
    default:
      return "Create at least 1 day, and for each day include breakfast, lunch, and dinner entries.";
  }
}

function buildPrompt(input: CreateMealPlanCriteriaInput): string {
  const { cuisine, spiceLevel, planType, medicalConditions, pantryItemsSnapshot } = input;

  const lines: string[] = [];

  lines.push("You are an expert meal planner and nutritionist.");
  lines.push("Generate a realistic, culturally appropriate meal plan that can be directly saved into a database.");
  lines.push("");
  lines.push(`Cuisine preference: ${cuisine}.`);
  lines.push(`Spice level preference: ${spiceLevel}.`);
  lines.push(`Plan type: ${planType}.`);

  if (medicalConditions && medicalConditions.length > 0) {
    lines.push(
      `Medical conditions or dietary constraints: ${medicalConditions.join(", ")}. Strictly avoid foods that conflict with these.`
    );
  } else {
    lines.push("No specific medical conditions are provided.");
  }

  if (pantryItemsSnapshot && pantryItemsSnapshot.length > 0) {
    lines.push(
      `Pantry items available: ${pantryItemsSnapshot.join(", ")}. Prefer using these ingredients when reasonable.`
    );
  } else {
    lines.push("No pantry items are provided; you may assume a typical household pantry.");
  }

  lines.push("");
  lines.push(
    buildPlanShapeInstruction(planType),
  );
  lines.push(
    "All meals must be compatible with the given cuisine and spice preferences. Use clear, simple language in instructions.",
  );
  lines.push(
    "For numeric nutrition values (calories, protein, carbs, fat) use best-effort approximations and leave them blank only if absolutely unknown.",
  );
  lines.push(
    "Return only data that fits the provided JSON schema. Do not include any commentary or explanations outside of the JSON structure.",
  );

  return lines.join("\n");
}

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

export async function generateMealPlanWithGemini(
  input: CreateMealPlanCriteriaInput,
): Promise<GeminiMealPlanResponse> {
  const prompt = buildPrompt(input);

  const request = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: mealPlanResponseSchema,
      temperature: 0.8,
    },
  } as unknown;

  const result = await model.generateContent(request as any);

  const responseText = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch (err) {
    throw new Error("Failed to parse Gemini response as JSON");
  }

  const candidate = parsed as GeminiMealPlanResponse;
  if (!candidate || !Array.isArray(candidate.days)) {
    throw new Error("Gemini returned an invalid meal plan structure");
  }

  return candidate;
}

// --- Single entry replacement (same shape as one entry in the plan schema) ---

const singleEntryResponseSchema = {
  type: SchemaType.OBJECT,
  description: "A single meal entry to replace an existing one in a plan.",
  properties: {
    entry: {
      type: SchemaType.OBJECT,
      properties: {
        mealSlot: {
          type: SchemaType.STRING,
          enum: ["breakfast", "lunch", "dinner"],
        },
        position: { type: SchemaType.NUMBER },
        title: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        searchKeyword: { type: SchemaType.STRING },
        imageUrl: { type: SchemaType.STRING },
        cookingTime: { type: SchemaType.STRING },
        difficulty: {
          type: SchemaType.STRING,
          enum: ["easy", "medium", "hard"],
        },
        instructions: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        ingredients: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              quantity: { type: SchemaType.STRING },
              unit: { type: SchemaType.STRING },
            },
            required: ["name"],
          },
        },
        servings: { type: SchemaType.NUMBER },
        calories: { type: SchemaType.NUMBER },
        protein: { type: SchemaType.NUMBER },
        carbs: { type: SchemaType.NUMBER },
        fat: { type: SchemaType.NUMBER },
        weight: { type: SchemaType.STRING },
      },
      required: [
        "mealSlot",
        "position",
        "title",
        "searchKeyword",
        "difficulty",
        "instructions",
        "ingredients",
      ],
    },
  },
  required: ["entry"],
} as const;

export type ReplaceEntryContext = {
  cuisine: string;
  spiceLevel: string;
  medicalConditions: string[] | null;
  pantryItemsSnapshot: string[] | null;
  mealSlot: "breakfast" | "lunch" | "dinner";
  position: number;
  avoidTitles: string[];
};

function buildReplaceEntryPrompt(ctx: ReplaceEntryContext): string {
  const lines: string[] = [];
  lines.push("You are an expert meal planner. Generate exactly ONE alternative meal entry.");
  lines.push(`Cuisine: ${ctx.cuisine}. Spice level: ${ctx.spiceLevel}.`);
  lines.push(`This meal must be for the slot: ${ctx.mealSlot}, at position ${ctx.position}.`);
  if (ctx.medicalConditions && ctx.medicalConditions.length > 0) {
    lines.push(`Strictly respect: ${ctx.medicalConditions.join(", ")}.`);
  }
  if (ctx.pantryItemsSnapshot && ctx.pantryItemsSnapshot.length > 0) {
    lines.push(`Prefer using: ${ctx.pantryItemsSnapshot.join(", ")}.`);
  }
  if (ctx.avoidTitles.length > 0) {
    lines.push(`Do NOT suggest any of these dishes (user already has them): ${ctx.avoidTitles.join(", ")}.`);
  }
  lines.push("Return only the JSON object matching the schema. No commentary.");
  return lines.join("\n");
}

export async function generateSingleMealEntryWithGemini(
  ctx: ReplaceEntryContext,
): Promise<GeminiMealPlanDayEntry> {
  const prompt = buildReplaceEntryPrompt(ctx);

  const request = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: singleEntryResponseSchema,
      temperature: 0.8,
    },
  } as unknown;

  const result = await model.generateContent(request as any);
  const responseText = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("Failed to parse Gemini response as JSON");
  }

  const candidate = parsed as { entry: GeminiMealPlanDayEntry };
  if (!candidate?.entry || typeof candidate.entry.title !== "string") {
    throw new Error("Gemini returned an invalid single entry structure");
  }

  return candidate.entry;
}

