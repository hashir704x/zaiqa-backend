import { z } from "zod";
import { cuisineEnum, spiceLevelEnum, planTypeEnum } from "../drizzle/schema";

export const CreateMealPlanCriteriaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  cuisine: z.enum(cuisineEnum.enumValues),
  spiceLevel: z.enum(spiceLevelEnum.enumValues),
  planType: z.enum(planTypeEnum.enumValues),
  medicalConditions: z.string().array().optional(),
  pantryItemsSnapshot: z.string().array().optional(),
});

export type CreateMealPlanCriteriaInput = z.infer<
  typeof CreateMealPlanCriteriaSchema
>;
