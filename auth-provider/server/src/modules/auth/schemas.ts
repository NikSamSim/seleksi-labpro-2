import { z } from "zod";

export const loginBodySchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email()
        .max(320),

    password: z
        .string()
        .min(1)
}).strict();

export const loginQuerySchema = z.object({
    returnTo: z
        .string()
        .optional()
}).strict();

export function isSafeReturnTo(
    returnTo: string | undefined
) {
    if (!returnTo) {
        return false;
    }

    return (
        returnTo.startsWith("/") &&
        !returnTo.startsWith("//")
    );
}

export type LoginInput =
    z.infer<typeof loginBodySchema>;