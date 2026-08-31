import { z } from "zod";

export const httpsUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "L'URL doit être en https.");
