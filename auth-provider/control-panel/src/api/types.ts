export type UserStatus =
    "active" |
    "inactive";

export type ApplicationStatus =
    "active" |
    "inactive";

export type PolicyEffect =
    "allow";

export type PaginationMeta = {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
};

export type PaginatedResult<T> = {
    items: T[];
    pagination: PaginationMeta;
};

export type PaginationQuery = {
    page?: number;
    pageSize?: number;
};

export type ListUsersQuery = PaginationQuery & {
    search?: string;
    status?: UserStatus;
};

export type ListGroupsQuery = PaginationQuery & {
    search?: string;
};

export type ListGroupUsersQuery = PaginationQuery & {
    search?: string;
    status?: UserStatus;
};

export type ListApplicationsQuery = PaginationQuery & {
    search?: string;
    status?: ApplicationStatus;
};

export type ListApplicationPoliciesQuery =
    PaginationQuery & {
        search?: string;
    };

export type User = {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
};

export type Group = {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
};

export type UserGroupMembership = {
    id: string;
    userId: string;
    groupId: string;
    createdAt?: string;
};

export type Application = {
    id: string;
    name: string;
    clientId: string;
    status: ApplicationStatus;
    launchUrl: string | null;
    logoutNotificationUrl: string;
    createdAt: string;
    updatedAt: string;
};

export type RedirectUri = {
    id: string;
    applicationId: string;
    redirectUri: string;
    createdAt: string;
};

export type ApplicationPolicy = {
    id: string;
    applicationId: string;
    groupId: string;
    groupName: string;
    effect: PolicyEffect;
    createdAt: string;
};

export type ApiErrorResponse = {
    error: {
        code: string;
        message: string;
        requestId: string;
    };
};

export type CreateUserInput = {
    name: string;
    email: string;
    password: string;
};

export type UpdateUserInput = {
    name?: string;
    email?: string;
};

export type UpdateUserStatusInput = {
    status: UserStatus;
};

export type UpdateUserPasswordInput = {
    password: string;
};

export type CreateGroupInput = {
    name: string;
    description?: string | null;
};

export type UpdateGroupInput = {
    name?: string;
    description?: string | null;
};

export type CreateApplicationInput = {
    name: string;
    clientId: string;
    launchUrl?: string | null;
    logoutNotificationUrl: string;
};

export type CreateApplicationResult = {
    application: Application;
    clientSecret: string;
};

export type UpdateApplicationInput = {
    name?: string;
    clientId?: string;
    launchUrl?: string | null;
    logoutNotificationUrl?: string;
};

export type UpdateApplicationStatusInput = {
    status: ApplicationStatus;
};

export type CreateRedirectUriInput = {
    redirectUri: string;
};

export type CreateApplicationPolicyInput = {
    groupId: string;
    effect: PolicyEffect;
};