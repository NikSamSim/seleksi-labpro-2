import { z } from "zod";

export const applicationPolicyParamsSchema = z.object({
    applicationId: z.string().uuid()
}).strict();

export const applicationPolicyIdParamsSchema = z.object({
    applicationId: z.string().uuid(),
    policyId: z.string().uuid()
}).strict();

export const createApplicationPolicyBodySchema = z.object({
    groupId: z.string().uuid(),
    effect: z.literal("allow")
}).strict();

export type CreateApplicationPolicyInput =
    z.infer<typeof createApplicationPolicyBodySchema>;