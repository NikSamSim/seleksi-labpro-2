import { z } from "zod";

export const callbackQuerySchema = z.object({
    state: z.string()
        .min(1)
        .max(512)
        .optional(),

    code: z.string()
        .min(1)
        .max(2048)
        .optional(),

    error: z.string()
        .min(1)
        .max(128)
        .optional()
});