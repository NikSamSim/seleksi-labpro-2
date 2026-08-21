import { z } from "zod";

export const confirmTotpEnrollmentBodySchema =
    z.object({
        code: z
            .string()
            .regex(/^\d{6}$/)
    }).strict();

export const loginMfaBodySchema =
    z.discriminatedUnion("method", [
        z.object({
            method: z.literal("totp"),
            code: z
                .string()
                .regex(/^\d{6}$/)
        }).strict(),

        z.object({
            method: z.literal("recovery"),
            code: z
                .string()
                .trim()
                .regex(/^[A-Za-z0-9_-]{16}$/)
        }).strict()
    ]);

export const startTotpReplacementBodySchema =
    z.object({
        currentPassword: z
            .string()
            .min(1)
    }).strict();

export const disableMfaBodySchema = z.object({
    currentPassword: z.string().min(1)
}).strict();