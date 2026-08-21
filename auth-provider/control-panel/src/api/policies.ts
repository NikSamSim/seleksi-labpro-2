import {
    apiRequest,
    withQuery
} from "./client";

import type {
    ApplicationPolicy,
    CreateApplicationPolicyInput,
    ListApplicationPoliciesQuery,
    PaginatedResult,
    PaginationMeta
} from "./types";

type ListApplicationPoliciesResponse = {
    policies: ApplicationPolicy[];
    pagination: PaginationMeta;
};

type ApplicationPolicyResponse = {
    policy: ApplicationPolicy;
};

export async function listApplicationPoliciesPage(
    applicationId: string,
    query: ListApplicationPoliciesQuery = {}
): Promise<PaginatedResult<ApplicationPolicy>> {
    const response =
        await apiRequest<ListApplicationPoliciesResponse>(
            withQuery(
                `/admin/applications/${applicationId}/policies`,
                {
                    page: query.page,
                    pageSize: query.pageSize,
                    search: query.search
                }
            )
        );

    return {
        items: response.policies,
        pagination: response.pagination
    };
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