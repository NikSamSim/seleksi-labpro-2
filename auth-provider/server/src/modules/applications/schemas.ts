import { z } from "zod";
import { paginationQuerySchema } from "../../http/pagination.js";

const applicationNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(255);

const clientIdSchema = z
    .string()
    .trim()
    .min(1)
    .max(255);

export const listApplicationsQuerySchema = paginationQuerySchema.extend({
    search: z.string().trim().max(255).optional(),

    status: z.enum([
        "active",
        "inactive"
    ]).optional()
}).strict();

const httpUrlSchema = z
    .string()
    .trim()
    .url()
    .refine(
        (value) => {
            const protocol = new URL(value).protocol;

            return (
                protocol === "http:" ||
                protocol === "https:"
            );
        },
        {
            message: "URL harus menggunakan http atau https"
        }
    );

const redirectUriSchema = httpUrlSchema.refine(
    (value) => !value.includes("*"),
    {
        message: "Redirect URI tidak boleh menggunakan wildcard"
    }
);

export const applicationIdParamsSchema = z.object({
    applicationId: z.string().uuid()
}).strict();

export const applicationRedirectUriParamsSchema = z.object({
    applicationId: z.string().uuid(),
    redirectUriId: z.string().uuid()
}).strict();

export const createApplicationBodySchema = z.object({
    name: applicationNameSchema,

    clientId: clientIdSchema,

    launchUrl: httpUrlSchema
        .nullable()
        .optional(),

    logoutNotificationUrl: httpUrlSchema
}).strict();

export const updateApplicationBodySchema = z.object({
    name: applicationNameSchema.optional(),

    clientId: clientIdSchema.optional(),

    launchUrl: httpUrlSchema
        .nullable()
        .optional(),

    logoutNotificationUrl:
        httpUrlSchema.optional()
})
    .strict()
    .refine(
        (body) =>
            body.name !== undefined ||
            body.clientId !== undefined ||
            body.launchUrl !== undefined ||
            body.logoutNotificationUrl !== undefined,
        {
            message: "Minimal satu field harus diubah"
        }
    );

export const updateApplicationStatusBodySchema = z.object({
    status: z.enum([
        "active",
        "inactive"
    ])
}).strict();

export const createRedirectUriBodySchema = z.object({
    redirectUri: redirectUriSchema
}).strict();

export type CreateApplicationInput =
    z.infer<typeof createApplicationBodySchema>;

export type UpdateApplicationInput =
    z.infer<typeof updateApplicationBodySchema>;

export type UpdateApplicationStatusInput =
    z.infer<typeof updateApplicationStatusBodySchema>;

export type CreateRedirectUriInput =
    z.infer<typeof createRedirectUriBodySchema>;

export type ListApplicationsQuery =
    z.infer<typeof listApplicationsQuerySchema>;