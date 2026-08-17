import { apiRequest } from "./client";

import type {
    CreateGroupInput,
    Group,
    UpdateGroupInput,
    User,
    UserGroupMembership
} from "./types";

type ListGroupsResponse = {
    groups: Group[];
};

type MembershipResponse = {
    membership: UserGroupMembership;
};

type GroupResponse = {
    group: Group;
};

type ListGroupUsersResponse = {
    users: User[];
};

export async function listGroups(): Promise<Group[]> {
    const response =
        await apiRequest<ListGroupsResponse>(
            "/admin/groups"
        );

    return response.groups;
}

export async function listGroupUsers(
    groupId: string
): Promise<User[]> {
    const response =
        await apiRequest<ListGroupUsersResponse>(
            `/admin/groups/${groupId}/users`
        );

    return response.users;
}

export async function listUserGroups(
    userId: string
): Promise<Group[]> {
    const response =
        await apiRequest<ListGroupsResponse>(
            `/admin/users/${userId}/groups`
        );

    return response.groups;
}

export async function addUserToGroup(
    userId: string,
    groupId: string
): Promise<UserGroupMembership> {
    const response =
        await apiRequest<MembershipResponse>(
            `/admin/users/${userId}/groups`,
            {
                method: "POST",
                body: JSON.stringify({
                    groupId
                })
            }
        );

    return response.membership;
}

export async function removeUserFromGroup(
    userId: string,
    groupId: string
): Promise<UserGroupMembership> {
    const response =
        await apiRequest<MembershipResponse>(
            `/admin/users/${userId}/groups/${groupId}`,
            {
                method: "DELETE"
            }
        );

    return response.membership;
}

export async function createGroup(
    input: CreateGroupInput
): Promise<Group> {
    const response =
        await apiRequest<GroupResponse>(
            "/admin/groups",
            {
                method: "POST",
                body: JSON.stringify(input)
            }
        );

    return response.group;
}

export async function updateGroup(
    groupId: string,
    input: UpdateGroupInput
): Promise<Group> {
    const response =
        await apiRequest<GroupResponse>(
            `/admin/groups/${groupId}`,
            {
                method: "PATCH",
                body: JSON.stringify(input)
            }
        );

    return response.group;
}