import { z } from "zod";

export const authorizeQuerySchema = z.object({
    response_type: z
        .string()
        .min(1)
        .max(32),

    client_id: z
        .string()
        .min(1)
        .max(255),

    redirect_uri: z
        .string()
        .url()
        .max(2048),

    state: z
        .string()
        .min(1)
        .max(512),

    code_challenge: z
        .string()
        .min(1)
        .max(255),

    code_challenge_method: z
        .string()
        .min(1)
        .max(32)
}).strict();

export type AuthorizeQuery =
    z.infer<typeof authorizeQuerySchema>;