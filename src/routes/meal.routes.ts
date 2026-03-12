import { Hono } from "hono";
import { requireAuth } from "../lib/auth-middleware";
import {
  createMealPlanController,
  listMealPlansController,
  getMealPlanController,
  replaceMealPlanEntryController,
  deleteMealPlanController,
} from "../controllers/meal.controllers";

const mealRoutes = new Hono();

mealRoutes.use("*", requireAuth);

mealRoutes.post("/", createMealPlanController);
mealRoutes.get("/", listMealPlansController);
mealRoutes.patch("/:planId/entries/:entryId", replaceMealPlanEntryController);
mealRoutes.delete("/:id", deleteMealPlanController);
mealRoutes.get("/:id", getMealPlanController);

export default mealRoutes;

