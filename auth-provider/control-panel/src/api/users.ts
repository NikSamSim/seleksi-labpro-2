import type {
    CreateUserInput,
    ListUsersQuery,
    PaginatedResult,
    PaginationMeta,
    UpdateUserInput,
    UpdateUserPasswordInput,
    UpdateUserStatusInput,
    User
} from "./types";
import {
    apiRequest,
    withQuery
} from "./client";

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