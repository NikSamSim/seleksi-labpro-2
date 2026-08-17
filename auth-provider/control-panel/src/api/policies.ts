import { apiRequest } from "./client";

import type {
    ApplicationPolicy,
    CreateApplicationPolicyInput
} from "./types";

type ListApplicationPoliciesResponse = {
    policies: ApplicationPolicy[];
};

type ApplicationPolicyResponse = {
    policy: ApplicationPolicy;
};

export async function listApplicationPolicies(
    applicationId: string
): Promise<ApplicationPolicy[]> {
    const response =
        await apiRequest<ListApplicationPoliciesResponse>(
            `/admin/applications/${applicationId}/policies`
        );

    return response.policies;
}

export async function createApplicationPolicy(
    applicationId: string,
    input: CreateApplicationPolicyInput
): Promise<ApplicationPolicy> {
    const response =
        await apiRequest<ApplicationPolicyResponse>(
            `/admin/applications/${applicationId}/policies`,
            {
                method: "POST",
                body: JSON.stringify(input)
            }
        );

    return response.policy;
}

export async function removeApplicationPolicy(
    applicationId: string,
    policyId: string
): Promise<ApplicationPolicy> {
    const response =
        await apiRequest<ApplicationPolicyResponse>(
            `/admin/applications/${applicationId}/policies/${policyId}`,
            {
                method: "DELETE"
            }
        );

    return response.policy;
}