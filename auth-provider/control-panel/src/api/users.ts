import type {
    CreateUserInput,
    ListUsersQuery,
    PaginatedResult,
    PaginationMeta,
    UpdateUserInput,
    UpdateUserPasswordInput,
    UpdateUserStatusInput,
    User,
    AdminResetUserMfaResult,
    UserMfaStatus
} from "./types";
import {
    apiRequest,
    withQuery
} from "./client";

type UserMfaResponse = {
    mfa: UserMfaStatus;
};

type ResetUserMfaResponse = {
    mfa: UserMfaStatus;
    reset: AdminResetUserMfaResult;
};

type ListUsersResponse = {
    users: User[];
    pagination: PaginationMeta;
};

type UserResponse = {
    user: User;
};

export async function listUsersPage(
    query: ListUsersQuery = {}
): Promise<PaginatedResult<User>> {
    const response =
        await apiRequest<ListUsersResponse>(
            withQuery(
                "/admin/users",
                {
                    page: query.page,
                    pageSize: query.pageSize,
                    search: query.search,
                    status: query.status
                }
            )
        );

    return {
        items: response.users,
        pagination: response.pagination
    };
}

export async function getUser(
    userId: string
): Promise<User> {
    const response =
        await apiRequest<UserResponse>(
            `/admin/users/${userId}`
        );

    return response.user;
}

export async function updateUserPassword(
    userId: string,
    input: UpdateUserPasswordInput
): Promise<User> {
    const response =
        await apiRequest<UserResponse>(
            `/admin/users/${userId}/password`,
            {
                method: "PUT",
                body: JSON.stringify(input)
            }
        );

    return response.user;
}

export async function createUser(
    input: CreateUserInput
): Promise<User> {
    const response =
        await apiRequest<UserResponse>(
            "/admin/users",
            {
                method: "POST",
                body: JSON.stringify(input)
            }
        );

    return response.user;
}

export async function updateUser(
    userId: string,
    input: UpdateUserInput
): Promise<User> {
    const response =
        await apiRequest<UserResponse>(
            `/admin/users/${userId}`,
            {
                method: "PATCH",
                body: JSON.stringify(input)
            }
        );

    return response.user;
}

export async function updateUserStatus(
    userId: string,
    input: UpdateUserStatusInput
): Promise<User> {
    const response =
        await apiRequest<UserResponse>(
            `/admin/users/${userId}/status`,
            {
                method: "PATCH",
                body: JSON.stringify(input)
            }
        );

    return response.user;
}

export async function getUserMfaStatus(
    userId: string
): Promise<UserMfaStatus> {
    const response = await apiRequest<UserMfaResponse>(
        `/admin/users/${userId}/mfa`
    );

    return response.mfa;
}

export async function resetUserMfa(
    userId: string
): Promise<ResetUserMfaResponse> {
    return apiRequest<ResetUserMfaResponse>(
        `/admin/users/${userId}/mfa/reset`,
        { method: "POST" }
    );
}