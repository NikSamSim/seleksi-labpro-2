import { z } from "zod";

const groupNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(255);

export const groupIdParamsSchema = z.object({
    groupId: z.string().uuid()
}).strict();

export const createGroupBodySchema = z.object({
    name: groupNameSchema,

    description: z
        .string()
        .trim()
        .nullable()
        .optional()
}).strict();

export const updateGroupBodySchema = z.object({
    name: groupNameSchema.optional(),

    description: z
        .string()
        .trim()
        .nullable()
        .optional()
})
    .strict()
    .refine(
        (body) =>
            body.name !== undefined ||
            body.description !== undefined,
        {
            message: "Minimal satu field harus diubah"
        }
    );

export const userMembershipParamsSchema = z.object({
    userId: z.string().uuid()
}).strict();

export const addUserGroupBodySchema = z.object({
    groupId: z.string().uuid()
}).strict();

export const userGroupMembershipParamsSchema = z.object({
    userId: z.string().uuid(),
    groupId: z.string().uuid()
}).strict();

export type CreateGroupInput =
    z.infer<typeof createGroupBodySchema>;

export type UpdateGroupInput =
    z.infer<typeof updateGroupBodySchema>;

export type AddUserGroupInput =
    z.infer<typeof addUserGroupBodySchema>;