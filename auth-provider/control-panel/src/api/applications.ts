import {
    apiRequest,
    withQuery
} from "./client";

import type {
    Application,
    CreateApplicationInput,
    CreateApplicationResult,
    CreateRedirectUriInput,
    ListApplicationsQuery,
    PaginatedResult,
    PaginationMeta,
    RedirectUri,
    UpdateApplicationInput,
    UpdateApplicationStatusInput
} from "./types";

type ListApplicationsResponse = {
    applications: Application[];
    pagination: PaginationMeta;
};

type ApplicationResponse = {
    application: Application;
};

type ListRedirectUrisResponse = {
    redirectUris: RedirectUri[];
};

type RedirectUriResponse = {
    redirectUri: RedirectUri;
};

export async function listApplicationsPage(
    query: ListApplicationsQuery = {}
): Promise<PaginatedResult<Application>> {
    const response =
        await apiRequest<ListApplicationsResponse>(
            withQuery(
                "/admin/applications",
                {
                    page: query.page,
                    pageSize: query.pageSize,
                    search: query.search,
                    status: query.status
                }
            )
        );

    return {
        items: response.applications,
        pagination: response.pagination
    };
}

export async function getApplication(
    applicationId: string
): Promise<Application> {
    const response =
        await apiRequest<ApplicationResponse>(
            `/admin/applications/${applicationId}`
        );

    return response.application;
}

export async function updateApplication(
    applicationId: string,
    input: UpdateApplicationInput
): Promise<Application> {
    const response =
        await apiRequest<ApplicationResponse>(
            `/admin/applications/${applicationId}`,
            {
                method: "PATCH",
                body: JSON.stringify(input)
            }
        );

    return response.application;
}

export async function createApplication(
    input: CreateApplicationInput
): Promise<CreateApplicationResult> {
    return apiRequest<CreateApplicationResult>(
        "/admin/applications",
        {
            method: "POST",
            body: JSON.stringify(input)
        }
    );
}

export async function updateApplicationStatus(
    applicationId: string,
    input: UpdateApplicationStatusInput
): Promise<Application> {
    const response =
        await apiRequest<ApplicationResponse>(
            `/admin/applications/${applicationId}/status`,
            {
                method: "PATCH",
                body: JSON.stringify(input)
            }
        );

    return response.application;
}

export async function listApplicationRedirectUris(
    applicationId: string
): Promise<RedirectUri[]> {
    const response =
        await apiRequest<ListRedirectUrisResponse>(
            `/admin/applications/${applicationId}/redirect-uris`
        );

    return response.redirectUris;
}

export async function addApplicationRedirectUri(
    applicationId: string,
    input: CreateRedirectUriInput
): Promise<RedirectUri> {
    const response =
        await apiRequest<RedirectUriResponse>(
            `/admin/applications/${applicationId}/redirect-uris`,
            {
                method: "POST",
                body: JSON.stringify(input)
            }
        );

    return response.redirectUri;
}

export async function removeApplicationRedirectUri(
    applicationId: string,
    redirectUriId: string
): Promise<RedirectUri> {
    const response =
        await apiRequest<RedirectUriResponse>(
            `/admin/applications/${applicationId}/redirect-uris/${redirectUriId}`,
            {
                method: "DELETE"
            }
        );

    return response.redirectUri;
}