import { apiRequest } from "./client";
import type {
    CreateUserInput,
    UpdateUserInput,
    UpdateUserPasswordInput,
    UpdateUserStatusInput,
    User
} from "./types";

type ListUsersResponse = {
    users: User[];
};

type UserResponse = {
    user: User;
};

export async function listUsers(): Promise<User[]> {
    const response =
        await apiRequest<ListUsersResponse>(
            "/admin/users"
        );

    return response.users;
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