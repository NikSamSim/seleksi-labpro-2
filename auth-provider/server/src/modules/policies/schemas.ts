import { z } from "zod";
import { paginationQuerySchema } from "../../http/pagination.js";

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

export const listApplicationPoliciesQuerySchema =
    paginationQuerySchema.extend({
        search: z.string().trim().max(255).optional()
    }).strict();

export type CreateApplicationPolicyInput =
    z.infer<typeof createApplicationPolicyBodySchema>;

export type ListApplicationPoliciesQuery =
    z.infer<typeof listApplicationPoliciesQuerySchema>;