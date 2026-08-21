import {
    apiRequest,
    withQuery
} from "./client";

import type {
    CreateGroupInput,
    Group,
    ListGroupsQuery,
    ListGroupUsersQuery,
    PaginatedResult,
    PaginationMeta,
    UpdateGroupInput,
    User,
    UserGroupMembership
} from "./types";

type ListGroupsResponse = {
    groups: Group[];
    pagination: PaginationMeta;
};

type MembershipResponse = {
    membership: UserGroupMembership;
};

type GroupResponse = {
    group: Group;
};

type ListGroupUsersResponse = {
    users: User[];
    pagination: PaginationMeta;
};

export async function listGroupsPage(
    query: ListGroupsQuery = {}
): Promise<PaginatedResult<Group>> {
    const response =
        await apiRequest<ListGroupsResponse>(
            withQuery(
                "/admin/groups",
                {
                    page: query.page,
                    pageSize: query.pageSize,
                    search: query.search
                }
            )
        );

    return {
        items: response.groups,
        pagination: response.pagination
    };
}

export async function getGroup(
    groupId: string
): Promise<Group> {
    const response =
        await apiRequest<GroupResponse>(
            `/admin/groups/${groupId}`
        );

    return response.group;
}

export async function listGroupUsersPage(
    groupId: string,
    query: ListGroupUsersQuery = {}
): Promise<PaginatedResult<User>> {
    const response =
        await apiRequest<ListGroupUsersResponse>(
            withQuery(
                `/admin/groups/${groupId}/users`,
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