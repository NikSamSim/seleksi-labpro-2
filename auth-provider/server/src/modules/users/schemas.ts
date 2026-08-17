import { z } from "zod";

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(320);

export const userIdParamsSchema = z.object({
    userId: z.string().uuid()
}).strict();

export const createUserBodySchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(255),

    email: emailSchema,

    password: z
        .string()
        .min(1)
}).strict();

export const updateUserBodySchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .optional(),

    email: emailSchema.optional()
})
    .strict()
    .refine(
        (body) =>
            body.name !== undefined ||
            body.email !== undefined,
        {
            message: "Minimal satu field harus diubah"
        }
    );

export const updateUserStatusBodySchema = z.object({
    status: z.enum([
        "active",
        "inactive"
    ])
}).strict();

export const updateUserPasswordBodySchema = z.object({
    password: z
        .string()
        .min(1)
}).strict();

export type CreateUserInput =
    z.infer<typeof createUserBodySchema>;

export type UpdateUserInput =
    z.infer<typeof updateUserBodySchema>;

export type UpdateUserStatusInput =
    z.infer<typeof updateUserStatusBodySchema>;

export type UpdateUserPasswordInput =
    z.infer<typeof updateUserPasswordBodySchema>;