import { Type } from "@google/genai";

export const LOG_FOOD_NAME = "logFood";

// Gemini function declaration for logging a food. The model ESTIMATES the values;
// they are validated with Zod (foodLogSchema) and shown to the user to confirm or
// correct BEFORE any database write. Function-call output is untrusted model
// output — never write it unvalidated.
export const LOG_FOOD_TOOL = {
  functionDeclarations: [
    {
      name: LOG_FOOD_NAME,
      description:
        "Log a food the user says they ate into their daily food diary. Estimate the amount, calories, and macros. Your estimate is shown to the user to confirm or correct before anything is saved, so estimate confidently and do not ask for exact numbers first. Only call this when the user clearly wants to record/log/track a food they ate — for questions, comparisons, or advice, reply with text instead.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          foodName: {
            type: Type.STRING,
            description: "Short name of the food, e.g. 'Grilled chicken breast'.",
          },
          mealType: {
            type: Type.STRING,
            enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"],
            description:
              "Which meal it belongs to. Infer from context or time of day; use SNACK if unclear.",
          },
          quantity: {
            type: Type.NUMBER,
            description: "Number of servings consumed, e.g. 1, 2, or 0.5.",
          },
          servingSize: {
            type: Type.NUMBER,
            description: "Grams or millilitres per serving.",
          },
          servingUnit: {
            type: Type.STRING,
            description:
              "Unit for the serving size: one of g, ml, piece, cup, serving, oz, tbsp, slice.",
          },
          calories: {
            type: Type.NUMBER,
            description: "Total calories for the logged amount (quantity × serving).",
          },
          protein: {
            type: Type.NUMBER,
            description: "Total protein in grams for the logged amount.",
          },
          carbs: {
            type: Type.NUMBER,
            description: "Total carbohydrates in grams for the logged amount.",
          },
          fat: {
            type: Type.NUMBER,
            description: "Total fat in grams for the logged amount.",
          },
        },
        required: [
          "foodName",
          "mealType",
          "quantity",
          "servingSize",
          "servingUnit",
          "calories",
          "protein",
          "carbs",
          "fat",
        ],
      },
    },
  ],
};
