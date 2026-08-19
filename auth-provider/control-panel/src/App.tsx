import {
    Fragment,
    type FormEvent,
    useEffect,
    useState
} from "react";

import {
    getAdminLoginUrl,
    getAdminSession,
    logoutAdmin,
    type AdminSession
} from "./api/admin";
import { ApiError } from "./api/client";

import {
    createUser,
    listUsers,
    updateUser,
    updateUserPassword,
    updateUserStatus
} from "./api/users";

import {
    addUserToGroup,
    createGroup,
    listGroups,
    listGroupUsers,
    listUserGroups,
    removeUserFromGroup,
    updateGroup
} from "./api/groups";

import {
    addApplicationRedirectUri,
    createApplication,
    listApplicationRedirectUris,
    listApplications,
    removeApplicationRedirectUri,
    updateApplication,
    updateApplicationStatus
} from "./api/applications";

import {
    createApplicationPolicy,
    listApplicationPolicies,
    removeApplicationPolicy
} from "./api/policies";

import type {
    Application,
    ApplicationPolicy,
    CreateApplicationInput,
    CreateGroupInput,
    CreateUserInput,
    Group,
    RedirectUri,
    UpdateApplicationInput,
    UpdateGroupInput,
    UpdateUserInput,
    User
} from "./api/types";

import "./App.css";

const initialCreateUserInput: CreateUserInput = {
    name: "",
    email: "",
    password: ""
};

const initialCreateGroupInput: CreateGroupInput = {
    name: "",
    description: ""
};

const initialCreateApplicationInput: CreateApplicationInput = {
    name: "",
    clientId: "",
    launchUrl: "",
    logoutNotificationUrl: ""
};

function App() {
    const [
        authState,
        setAuthState
    ] = useState<
        | "checking"
        | "signed-out"
        | "forbidden"
        | "authenticated"
        | "error"
    >("checking");

    const [
        adminSession,
        setAdminSession
    ] = useState<AdminSession | null>(null);

    const [
        authError,
        setAuthError
    ] = useState<string | null>(null);

    const [users, setUsers] =
        useState<User[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [createInput, setCreateInput] =
        useState<CreateUserInput>(
            initialCreateUserInput
        );

    const [creating, setCreating] =
        useState(false);

    const [createError, setCreateError] =
        useState<string | null>(null);

    const [editingUserId, setEditingUserId] =
        useState<string | null>(null);

    const [editInput, setEditInput] =
        useState<UpdateUserInput>({});

    const [updating, setUpdating] =
        useState(false);

    const [editError, setEditError] =
        useState<string | null>(null);

    const [
        statusUpdatingUserId,
        setStatusUpdatingUserId
    ] = useState<string | null>(null);

    const [statusError, setStatusError] =
        useState<string | null>(null);

    const [
        passwordEditingUserId,
        setPasswordEditingUserId
    ] = useState<string | null>(null);

    const [newPassword, setNewPassword] =
        useState("");

    const [passwordUpdating, setPasswordUpdating] =
        useState(false);

    const [passwordError, setPasswordError] =
        useState<string | null>(null);

    const [
        groupsEditingUserId,
        setGroupsEditingUserId
    ] = useState<string | null>(null);

    const [userGroups, setUserGroups] =
        useState<Group[]>([]);

    const [groupsLoading, setGroupsLoading] =
        useState(false);

    const [groupsError, setGroupsError] =
        useState<string | null>(null);

    const [selectedGroupId, setSelectedGroupId] =
        useState("");

    const [membershipUpdating, setMembershipUpdating] =
        useState(false);

    const [membershipError, setMembershipError] =
        useState<string | null>(null);

    const [groups, setGroups] =
        useState<Group[]>([]);

    const [groupsListLoading, setGroupsListLoading] =
        useState(true);

    const [groupsListError, setGroupsListError] =
        useState<string | null>(null);

    const [createGroupInput, setCreateGroupInput] =
        useState<CreateGroupInput>(
            initialCreateGroupInput
        );

    const [groupCreating, setGroupCreating] =
        useState(false);

    const [groupCreateError, setGroupCreateError] =
        useState<string | null>(null);

    const [editingGroupId, setEditingGroupId] =
        useState<string | null>(null);

    const [editGroupInput, setEditGroupInput] =
        useState<UpdateGroupInput>({});

    const [groupUpdating, setGroupUpdating] =
        useState(false);

    const [groupEditError, setGroupEditError] =
        useState<string | null>(null);

    const [
        membersEditingGroupId,
        setMembersEditingGroupId
    ] = useState<string | null>(null);

    const [groupUsers, setGroupUsers] =
        useState<User[]>([]);

    const [groupUsersLoading, setGroupUsersLoading] =
        useState(false);

    const [groupUsersError, setGroupUsersError] =
        useState<string | null>(null);

    const [applications, setApplications] =
        useState<Application[]>([]);

    const [
        applicationsLoading,
        setApplicationsLoading
    ] = useState(true);

    const [
        applicationsError,
        setApplicationsError
    ] = useState<string | null>(null);

    const [
        createApplicationInput,
        setCreateApplicationInput
    ] = useState<CreateApplicationInput>(
        initialCreateApplicationInput
    );

    const [
        applicationCreating,
        setApplicationCreating
    ] = useState(false);

    const [
        applicationCreateError,
        setApplicationCreateError
    ] = useState<string | null>(null);

    const [
        createdClientSecret,
        setCreatedClientSecret
    ] = useState<{
        applicationName: string;
        clientId: string;
        clientSecret: string;
    } | null>(null);

    const [
        editingApplicationId,
        setEditingApplicationId
    ] = useState<string | null>(null);

    const [
        editApplicationInput,
        setEditApplicationInput
    ] = useState<UpdateApplicationInput>({});

    const [
        applicationUpdating,
        setApplicationUpdating
    ] = useState(false);

    const [
        applicationEditError,
        setApplicationEditError
    ] = useState<string | null>(null);

    const [
        statusUpdatingApplicationId,
        setStatusUpdatingApplicationId
    ] = useState<string | null>(null);

    const [
        applicationStatusError,
        setApplicationStatusError
    ] = useState<string | null>(null);

    const [
        redirectUrisEditingApplicationId,
        setRedirectUrisEditingApplicationId
    ] = useState<string | null>(null);

    const [applicationRedirectUris, setApplicationRedirectUris] =
        useState<RedirectUri[]>([]);

    const [newRedirectUri, setNewRedirectUri] =
        useState("");

    const [redirectUrisLoading, setRedirectUrisLoading] =
        useState(false);

    const [redirectUriUpdating, setRedirectUriUpdating] =
        useState(false);

    const [redirectUrisError, setRedirectUrisError] =
        useState<string | null>(null);

    const [
        policiesEditingApplicationId,
        setPoliciesEditingApplicationId
    ] = useState<string | null>(null);

    const [applicationPolicies, setApplicationPolicies] =
        useState<ApplicationPolicy[]>([]);

    const [selectedPolicyGroupId, setSelectedPolicyGroupId] =
        useState("");

    const [policiesLoading, setPoliciesLoading] =
        useState(false);

    const [policyUpdating, setPolicyUpdating] =
        useState(false);

    const [policiesError, setPoliciesError] =
        useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function checkAdminSession() {
            try {
                const session =
                    await getAdminSession();

                if (cancelled) {
                    return;
                }

                setAdminSession(session);
                setAuthState("authenticated");
            } catch (error) {
                if (cancelled) {
                    return;
                }

                if (
                    error instanceof ApiError &&
                    error.status === 401
                ) {
                    setAuthState("signed-out");
                    return;
                }

                if (
                    error instanceof ApiError &&
                    error.status === 403
                ) {
                    setAuthState("forbidden");
                    return;
                }

                setAuthError(
                    error instanceof Error
                        ? error.message
                        : "Gagal memeriksa session"
                );
                setAuthState("error");
            }
        }

        void checkAdminSession();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (authState !== "signed-out") {
            return;
        }

        window.location.assign(
            getAdminLoginUrl()
        );
    }, [authState]);

    useEffect(() => {
        if (authState !== "authenticated") {
            return;
        }

        async function loadUsers() {
            try {
                const data = await listUsers();

                setUsers(data);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil daftar user"
                );
            } finally {
                setLoading(false);
            }
        }

        void loadUsers();
    }, [authState]);

    useEffect(() => {
        if (authState !== "authenticated") {
            return;
        }

        async function loadGroups() {
            try {
                const data = await listGroups();

                setGroups(data);
            } catch (error) {
                setGroupsListError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil daftar group"
                );
            } finally {
                setGroupsListLoading(false);
            }
        }

        void loadGroups();
    }, [authState]);

    useEffect(() => {
        if (authState !== "authenticated") {
            return;
        }

        async function loadApplications() {
            try {
                const data =
                    await listApplications();

                setApplications(data);
            } catch (error) {
                setApplicationsError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil daftar application"
                );
            } finally {
                setApplicationsLoading(false);
            }
        }

        void loadApplications();
    }, [authState]);

    async function handleAdminLogout() {
        setAuthError(null);

        try {
            await logoutAdmin();
        } catch (error) {
            setAuthError(
                error instanceof Error
                    ? error.message
                    : "Logout gagal"
            );

            return;
        }

        setAdminSession(null);
        setUsers([]);
        setGroups([]);
        setApplications([]);
        setAuthState("signed-out");
    }

    async function handleCreateUser(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setCreating(true);
        setCreateError(null);

        try {
            const user =
                await createUser(createInput);

            setUsers((currentUsers) => [
                ...currentUsers,
                user
            ]);

            setCreateInput(
                initialCreateUserInput
            );
        } catch (error) {
            setCreateError(
                error instanceof Error
                    ? error.message
                    : "Gagal membuat user"
            );
        } finally {
            setCreating(false);
        }
    }

    function startEditing(user: User) {
        setEditingUserId(user.id);

        setEditInput({
            name: user.name,
            email: user.email
        });

        setEditError(null);
    }

    function cancelEditing() {
        setEditingUserId(null);
        setEditInput({});
        setEditError(null);
    }

    async function handleUpdateUser(
        userId: string
    ) {
        setUpdating(true);
        setEditError(null);

        try {
            const updatedUser =
                await updateUser(
                    userId,
                    editInput
                );

            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === updatedUser.id
                        ? updatedUser
                        : user
                )
            );

            setEditingUserId(null);
            setEditInput({});
        } catch (error) {
            setEditError(
                error instanceof Error
                    ? error.message
                    : "Gagal memperbarui user"
            );
        } finally {
            setUpdating(false);
        }
    }

    async function handleToggleUserStatus(
        user: User
    ) {
        const nextStatus =
            user.status === "active"
                ? "inactive"
                : "active";

        setStatusUpdatingUserId(user.id);
        setStatusError(null);

        try {
            const updatedUser =
                await updateUserStatus(
                    user.id,
                    {
                        status: nextStatus
                    }
                );

            setUsers((currentUsers) =>
                currentUsers.map((currentUser) =>
                    currentUser.id === updatedUser.id
                        ? updatedUser
                        : currentUser
                )
            );
        } catch (error) {
            setStatusError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengubah status user"
            );
        } finally {
            setStatusUpdatingUserId(null);
        }
    }

    function startChangingPassword(
        user: User
    ) {
        setPasswordEditingUserId(user.id);
        setNewPassword("");
        setPasswordError(null);
    }

    function cancelChangingPassword() {
        setPasswordEditingUserId(null);
        setNewPassword("");
        setPasswordError(null);
    }

    async function handleChangePassword(
        userId: string
    ) {
        setPasswordUpdating(true);
        setPasswordError(null);

        try {
            await updateUserPassword(
                userId,
                {
                    password: newPassword
                }
            );

            setPasswordEditingUserId(null);
            setNewPassword("");
        } catch (error) {
            setPasswordError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengubah password"
            );
        } finally {
            setPasswordUpdating(false);
        }
    }

    async function startManagingGroups(
        user: User
    ) {
        setGroupsEditingUserId(user.id);
        setUserGroups([]);
        setSelectedGroupId("");
        setGroupsLoading(true);
        setGroupsError(null);
        setMembershipError(null);

        try {
            const memberships =
                await listUserGroups(user.id);

            setUserGroups(memberships);
        } catch (error) {
            setGroupsError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil membership user"
            );
        } finally {
            setGroupsLoading(false);
        }
    }

    function stopManagingGroups() {
        setGroupsEditingUserId(null);
        setUserGroups([]);
        setSelectedGroupId("");
        setGroupsError(null);
        setMembershipError(null);
    }

    async function handleAddUserToGroup(
        userId: string
    ) {
        if (!selectedGroupId) {
            return;
        }

        const selectedGroup =
            groups.find(
                (group) =>
                    group.id === selectedGroupId
            );

        if (!selectedGroup) {
            setMembershipError(
                "Group yang dipilih tidak ditemukan"
            );

            return;
        }

        setMembershipUpdating(true);
        setMembershipError(null);

        try {
            await addUserToGroup(
                userId,
                selectedGroup.id
            );

            setUserGroups((currentGroups) => [
                ...currentGroups,
                selectedGroup
            ]);

            setSelectedGroupId("");
        } catch (error) {
            setMembershipError(
                error instanceof Error
                    ? error.message
                    : "Gagal menambahkan user ke group"
            );
        } finally {
            setMembershipUpdating(false);
        }
    }

    async function handleRemoveUserFromGroup(
        userId: string,
        groupId: string
    ) {
        setMembershipUpdating(true);
        setMembershipError(null);

        try {
            await removeUserFromGroup(
                userId,
                groupId
            );

            setUserGroups((currentGroups) =>
                currentGroups.filter(
                    (group) =>
                        group.id !== groupId
                )
            );
        } catch (error) {
            setMembershipError(
                error instanceof Error
                    ? error.message
                    : "Gagal menghapus user dari group"
            );
        } finally {
            setMembershipUpdating(false);
        }
    }

    async function handleCreateGroup(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setGroupCreating(true);
        setGroupCreateError(null);

        try {
            const group = await createGroup({
                name: createGroupInput.name,
                description:
                    createGroupInput.description?.trim()
                        ? createGroupInput.description
                        : null
            });

            setGroups((currentGroups) => [
                ...currentGroups,
                group
            ]);

            setCreateGroupInput(
                initialCreateGroupInput
            );
        } catch (error) {
            setGroupCreateError(
                error instanceof Error
                    ? error.message
                    : "Gagal membuat group"
            );
        } finally {
            setGroupCreating(false);
        }
    }

    function startEditingGroup(
        group: Group
    ) {
        setEditingGroupId(group.id);

        setEditGroupInput({
            name: group.name,
            description:
                group.description ?? ""
        });

        setGroupEditError(null);
    }

    function cancelEditingGroup() {
        setEditingGroupId(null);
        setEditGroupInput({});
        setGroupEditError(null);
    }

    async function handleUpdateGroup(
        groupId: string
    ) {
        setGroupUpdating(true);
        setGroupEditError(null);

        try {
            const updatedGroup =
                await updateGroup(
                    groupId,
                    {
                        name: editGroupInput.name,
                        description:
                            editGroupInput.description?.trim()
                                ? editGroupInput.description
                                : null
                    }
                );

            setGroups((currentGroups) =>
                currentGroups.map((group) =>
                    group.id === updatedGroup.id
                        ? updatedGroup
                        : group
                )
            );

            setUserGroups((currentGroups) =>
                currentGroups.map((group) =>
                    group.id === updatedGroup.id
                        ? updatedGroup
                        : group
                )
            );

            setEditingGroupId(null);
            setEditGroupInput({});
        } catch (error) {
            setGroupEditError(
                error instanceof Error
                    ? error.message
                    : "Gagal memperbarui group"
            );
        } finally {
            setGroupUpdating(false);
        }
    }

    async function startViewingGroupUsers(
        group: Group
    ) {
        setMembersEditingGroupId(group.id);
        setGroupUsers([]);
        setGroupUsersLoading(true);
        setGroupUsersError(null);

        try {
            const members =
                await listGroupUsers(group.id);

            setGroupUsers(members);
        } catch (error) {
            setGroupUsersError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil member group"
            );
        } finally {
            setGroupUsersLoading(false);
        }
    }

    function stopViewingGroupUsers() {
        setMembersEditingGroupId(null);
        setGroupUsers([]);
        setGroupUsersError(null);
    }

    async function handleCreateApplication(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setApplicationCreating(true);
        setApplicationCreateError(null);

        try {
            const result =
                await createApplication({
                    name:
                        createApplicationInput.name,
                    clientId:
                        createApplicationInput.clientId,
                    launchUrl:
                        createApplicationInput.launchUrl?.trim()
                            ? createApplicationInput.launchUrl
                            : null,
                    logoutNotificationUrl:
                        createApplicationInput.logoutNotificationUrl
                });

            setApplications(
                (currentApplications) => [
                    ...currentApplications,
                    result.application
                ]
            );

            setCreatedClientSecret({
                applicationName:
                    result.application.name,
                clientId:
                    result.application.clientId,
                clientSecret:
                    result.clientSecret
            });

            setCreateApplicationInput(
                initialCreateApplicationInput
            );
        } catch (error) {
            setApplicationCreateError(
                error instanceof Error
                    ? error.message
                    : "Gagal membuat application"
            );
        } finally {
            setApplicationCreating(false);
        }
    }

    function startEditingApplication(
        application: Application
    ) {
        setEditingApplicationId(application.id);

        setEditApplicationInput({
            name: application.name,
            clientId: application.clientId,
            launchUrl: application.launchUrl ?? "",
            logoutNotificationUrl:
                application.logoutNotificationUrl
        });

        setApplicationEditError(null);
    }

    function cancelEditingApplication() {
        setEditingApplicationId(null);
        setEditApplicationInput({});
        setApplicationEditError(null);
    }

    async function handleUpdateApplication(
        applicationId: string
    ) {
        setApplicationUpdating(true);
        setApplicationEditError(null);

        try {
            const updatedApplication =
                await updateApplication(
                    applicationId,
                    {
                        name:
                            editApplicationInput.name,
                        clientId:
                            editApplicationInput.clientId,
                        launchUrl:
                            editApplicationInput.launchUrl?.trim()
                                ? editApplicationInput.launchUrl
                                : null,
                        logoutNotificationUrl:
                            editApplicationInput.logoutNotificationUrl
                    }
                );

            setApplications(
                (currentApplications) =>
                    currentApplications.map(
                        (application) =>
                            application.id ===
                            updatedApplication.id
                                ? updatedApplication
                                : application
                    )
            );

            setEditingApplicationId(null);
            setEditApplicationInput({});
        } catch (error) {
            setApplicationEditError(
                error instanceof Error
                    ? error.message
                    : "Gagal memperbarui application"
            );
        } finally {
            setApplicationUpdating(false);
        }
    }

    async function handleToggleApplicationStatus(
        application: Application
    ) {
        const nextStatus =
            application.status === "active"
                ? "inactive"
                : "active";

        setStatusUpdatingApplicationId(
            application.id
        );
        setApplicationStatusError(null);

        try {
            const updatedApplication =
                await updateApplicationStatus(
                    application.id,
                    {
                        status: nextStatus
                    }
                );

            setApplications(
                (currentApplications) =>
                    currentApplications.map(
                        (currentApplication) =>
                            currentApplication.id ===
                            updatedApplication.id
                                ? updatedApplication
                                : currentApplication
                    )
            );
        } catch (error) {
            setApplicationStatusError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengubah status application"
            );
        } finally {
            setStatusUpdatingApplicationId(
                null
            );
        }
    }

    async function startManagingRedirectUris(
        application: Application
    ) {
        setRedirectUrisEditingApplicationId(
            application.id
        );
        setApplicationRedirectUris([]);
        setNewRedirectUri("");
        setRedirectUrisLoading(true);
        setRedirectUrisError(null);

        try {
            const redirectUris =
                await listApplicationRedirectUris(
                    application.id
                );

            setApplicationRedirectUris(
                redirectUris
            );
        } catch (error) {
            setRedirectUrisError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil redirect URI"
            );
        } finally {
            setRedirectUrisLoading(false);
        }
    }

    function stopManagingRedirectUris() {
        setRedirectUrisEditingApplicationId(null);
        setApplicationRedirectUris([]);
        setNewRedirectUri("");
        setRedirectUrisError(null);
    }

    async function handleAddRedirectUri(
        applicationId: string
    ) {
        if (!newRedirectUri.trim()) {
            return;
        }

        setRedirectUriUpdating(true);
        setRedirectUrisError(null);

        try {
            const redirectUri =
                await addApplicationRedirectUri(
                    applicationId,
                    {
                        redirectUri: newRedirectUri
                    }
                );

            setApplicationRedirectUris(
                (currentRedirectUris) => [
                    ...currentRedirectUris,
                    redirectUri
                ]
            );

            setNewRedirectUri("");
        } catch (error) {
            setRedirectUrisError(
                error instanceof Error
                    ? error.message
                    : "Gagal menambahkan redirect URI"
            );
        } finally {
            setRedirectUriUpdating(false);
        }
    }

    async function handleRemoveRedirectUri(
        applicationId: string,
        redirectUriId: string
    ) {
        setRedirectUriUpdating(true);
        setRedirectUrisError(null);

        try {
            await removeApplicationRedirectUri(
                applicationId,
                redirectUriId
            );

            setApplicationRedirectUris(
                (currentRedirectUris) =>
                    currentRedirectUris.filter(
                        (redirectUri) =>
                            redirectUri.id !==
                            redirectUriId
                    )
            );
        } catch (error) {
            setRedirectUrisError(
                error instanceof Error
                    ? error.message
                    : "Gagal menghapus redirect URI"
            );
        } finally {
            setRedirectUriUpdating(false);
        }
    }

    async function startManagingPolicies(
        application: Application
    ) {
        setPoliciesEditingApplicationId(
            application.id
        );
        setApplicationPolicies([]);
        setSelectedPolicyGroupId("");
        setPoliciesLoading(true);
        setPoliciesError(null);

        try {
            const policies =
                await listApplicationPolicies(
                    application.id
                );

            setApplicationPolicies(policies);
        } catch (error) {
            setPoliciesError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil policy application"
            );
        } finally {
            setPoliciesLoading(false);
        }
    }

    function stopManagingPolicies() {
        setPoliciesEditingApplicationId(null);
        setApplicationPolicies([]);
        setSelectedPolicyGroupId("");
        setPoliciesError(null);
    }

    async function handleAddPolicy(
        applicationId: string
    ) {
        if (!selectedPolicyGroupId) {
            return;
        }

        setPolicyUpdating(true);
        setPoliciesError(null);

        try {
            const policy =
                await createApplicationPolicy(
                    applicationId,
                    {
                        groupId: selectedPolicyGroupId,
                        effect: "allow"
                    }
                );

            setApplicationPolicies(
                (currentPolicies) => [
                    ...currentPolicies,
                    policy
                ]
            );

            setSelectedPolicyGroupId("");
        } catch (error) {
            setPoliciesError(
                error instanceof Error
                    ? error.message
                    : "Gagal menambahkan policy"
            );
        } finally {
            setPolicyUpdating(false);
        }
    }

    async function handleRemovePolicy(
        applicationId: string,
        policyId: string
    ) {
        setPolicyUpdating(true);
        setPoliciesError(null);

        try {
            await removeApplicationPolicy(
                applicationId,
                policyId
            );

            setApplicationPolicies(
                (currentPolicies) =>
                    currentPolicies.filter(
                        (policy) =>
                            policy.id !== policyId
                    )
            );
        } catch (error) {
            setPoliciesError(
                error instanceof Error
                    ? error.message
                    : "Gagal menghapus policy"
            );
        } finally {
            setPolicyUpdating(false);
        }
    }

    if (authState === "checking") {
        return (
            <main className="control-panel">
                <h1>Labpro Auth Provider</h1>
                <h2>Control Panel</h2>
                <p>Memeriksa authentication...</p>
            </main>
        );
    }

    if (authState === "signed-out") {
        return (
            <main className="control-panel">
                <h1>Labpro Auth Provider</h1>
                <h2>Control Panel</h2>

                <p>
                    Mengarahkan ke Central Login...
                </p>
            </main>
        );
    }

    if (authState === "forbidden") {
        return (
            <main className="control-panel">
                <h1>Labpro Auth Provider</h1>
                <h2>Control Panel</h2>

                <h3>Access Denied</h3>

                <p>
                    User yang sedang login bukan
                    anggota group administrators.
                </p>

                <button
                    type="button"
                    onClick={() =>
                        void handleAdminLogout()
                    }
                >
                    Logout
                </button>
            </main>
        );
    }

    if (authState === "error") {
        return (
            <main className="control-panel">
                <h1>Labpro Auth Provider</h1>
                <h2>Control Panel</h2>

                <p>
                    Gagal memeriksa authentication:{" "}
                    {authError}
                </p>
            </main>
        );
    }

    const availableGroups =
        groups.filter(
            (group) =>
                !userGroups.some(
                    (userGroup) =>
                        userGroup.id === group.id
                )
        );

    const availablePolicyGroups =
        groups.filter(
            (group) =>
                !applicationPolicies.some(
                    (policy) =>
                        policy.groupId === group.id
                )
        );

    return (
        <main className="control-panel">
            <h1>Labpro Auth Provider</h1>
            <h2>Control Panel</h2>

            {adminSession && (
                <div>
                    <p>
                        Signed in as{" "}
                        <strong>
                            {adminSession.user.name}
                        </strong>{" "}
                        ({adminSession.user.email})
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            void handleAdminLogout()
                        }
                    >
                        Logout
                    </button>
                </div>
            )}

            <section>
                <h3>Create User</h3>

                <form onSubmit={handleCreateUser}>
                    <div>
                        <label htmlFor="name">
                            Name
                        </label>

                        <input
                            id="name"
                            type="text"
                            value={createInput.name}
                            onChange={(event) =>
                                setCreateInput({
                                    ...createInput,
                                    name: event.target.value
                                })
                            }
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="email">
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={createInput.email}
                            onChange={(event) =>
                                setCreateInput({
                                    ...createInput,
                                    email: event.target.value
                                })
                            }
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            value={createInput.password}
                            onChange={(event) =>
                                setCreateInput({
                                    ...createInput,
                                    password: event.target.value
                                })
                            }
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={creating}
                    >
                        {creating
                            ? "Creating..."
                            : "Create User"}
                    </button>

                    {createError && (
                        <p>
                            Gagal membuat user:{" "}
                            {createError}
                        </p>
                    )}
                </form>
            </section>

            <section>
                <h3>Users</h3>

                {loading && (
                    <p>Memuat user...</p>
                )}

                {error && (
                    <p>
                        Gagal memuat user: {error}
                    </p>
                )}

                {!loading &&
                    !error &&
                    users.length === 0 && (
                        <p>Belum ada user.</p>
                    )}

                {!loading &&
                    !error &&
                    users.length > 0 && (
                        <>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {users.map((user) => (
                                        <Fragment key={user.id}>
                                            <tr>
                                                {editingUserId === user.id ? (
                                                    <>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={
                                                                    editInput.name ??
                                                                    ""
                                                                }
                                                                onChange={(event) =>
                                                                    setEditInput({
                                                                        ...editInput,
                                                                        name:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    })
                                                                }
                                                            />
                                                        </td>

                                                        <td>
                                                            <input
                                                                type="email"
                                                                value={
                                                                    editInput.email ??
                                                                    ""
                                                                }
                                                                onChange={(event) =>
                                                                    setEditInput({
                                                                        ...editInput,
                                                                        email:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    })
                                                                }
                                                            />
                                                        </td>

                                                        <td>
                                                            {user.status}
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void handleUpdateUser(
                                                                        user.id
                                                                    )
                                                                }
                                                                disabled={updating}
                                                            >
                                                                {updating
                                                                    ? "Saving..."
                                                                    : "Save"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    cancelEditing
                                                                }
                                                                disabled={updating}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>
                                                            {user.name}
                                                        </td>

                                                        <td>
                                                            {user.email}
                                                        </td>

                                                        <td>
                                                            {user.status}
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    startEditing(
                                                                        user
                                                                    )
                                                                }
                                                                disabled={
                                                                    statusUpdatingUserId ===
                                                                    user.id
                                                                }
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void handleToggleUserStatus(
                                                                        user
                                                                    )
                                                                }
                                                                disabled={
                                                                    statusUpdatingUserId ===
                                                                    user.id
                                                                }
                                                            >
                                                                {statusUpdatingUserId ===
                                                                user.id
                                                                    ? "Updating..."
                                                                    : user.status ===
                                                                        "active"
                                                                      ? "Deactivate"
                                                                      : "Activate"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    startChangingPassword(
                                                                        user
                                                                    )
                                                                }
                                                            >
                                                                Change Password
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void startManagingGroups(
                                                                        user
                                                                    )
                                                                }
                                                                disabled={
                                                                    groupsLoading
                                                                }
                                                            >
                                                                Manage Groups
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>

                                            {passwordEditingUserId ===
                                                user.id && (
                                                <tr>
                                                    <td colSpan={4}>
                                                        <input
                                                            type="password"
                                                            value={
                                                                newPassword
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                setNewPassword(
                                                                    event
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="New password"
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void handleChangePassword(
                                                                    user.id
                                                                )
                                                            }
                                                            disabled={
                                                                passwordUpdating ||
                                                                newPassword.length ===
                                                                    0
                                                            }
                                                        >
                                                            {passwordUpdating
                                                                ? "Changing..."
                                                                : "Save Password"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={
                                                                cancelChangingPassword
                                                            }
                                                            disabled={
                                                                passwordUpdating
                                                            }
                                                        >
                                                            Cancel
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}

                                            {groupsEditingUserId ===
                                                user.id && (
                                                <tr>
                                                    <td colSpan={4}>
                                                        <strong>
                                                            Groups
                                                        </strong>

                                                        {groupsLoading && (
                                                            <p>
                                                                Memuat group...
                                                            </p>
                                                        )}

                                                        {!groupsLoading &&
                                                            !groupsError && (
                                                                <>
                                                                    {userGroups.length ===
                                                                    0 ? (
                                                                        <p>
                                                                            User
                                                                            belum
                                                                            memiliki
                                                                            group.
                                                                        </p>
                                                                    ) : (
                                                                        <ul>
                                                                            {userGroups.map(
                                                                                (
                                                                                    group
                                                                                ) => (
                                                                                    <li
                                                                                        key={
                                                                                            group.id
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            group.name
                                                                                        }{" "}
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                void handleRemoveUserFromGroup(
                                                                                                    user.id,
                                                                                                    group.id
                                                                                                )
                                                                                            }
                                                                                            disabled={
                                                                                                membershipUpdating
                                                                                            }
                                                                                        >
                                                                                            Remove
                                                                                        </button>
                                                                                    </li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    )}

                                                                    {availableGroups.length >
                                                                    0 ? (
                                                                        <div>
                                                                            <select
                                                                                value={
                                                                                    selectedGroupId
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    setSelectedGroupId(
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    membershipUpdating
                                                                                }
                                                                            >
                                                                                <option value="">
                                                                                    Select
                                                                                    group
                                                                                </option>

                                                                                {availableGroups.map(
                                                                                    (
                                                                                        group
                                                                                    ) => (
                                                                                        <option
                                                                                            key={
                                                                                                group.id
                                                                                            }
                                                                                            value={
                                                                                                group.id
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                group.name
                                                                                            }
                                                                                        </option>
                                                                                    )
                                                                                )}
                                                                            </select>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    void handleAddUserToGroup(
                                                                                        user.id
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    membershipUpdating ||
                                                                                    selectedGroupId.length ===
                                                                                        0
                                                                                }
                                                                            >
                                                                                {membershipUpdating
                                                                                    ? "Updating..."
                                                                                    : "Add Group"}
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <p>
                                                                            User
                                                                            sudah
                                                                            berada
                                                                            di
                                                                            semua
                                                                            group.
                                                                        </p>
                                                                    )}
                                                                </>
                                                            )}

                                                        {groupsError && (
                                                            <p>
                                                                Gagal memuat
                                                                group:{" "}
                                                                {groupsError}
                                                            </p>
                                                        )}

                                                        {membershipError && (
                                                            <p>
                                                                Gagal mengubah
                                                                membership:{" "}
                                                                {
                                                                    membershipError
                                                                }
                                                            </p>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={
                                                                stopManagingGroups
                                                            }
                                                            disabled={
                                                                membershipUpdating
                                                            }
                                                        >
                                                            Close
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>

                            {statusError && (
                                <p>
                                    Gagal mengubah status user:{" "}
                                    {statusError}
                                </p>
                            )}

                            {editError && (
                                <p>
                                    Gagal memperbarui user:{" "}
                                    {editError}
                                </p>
                            )}

                            {passwordError && (
                                <p>
                                    Gagal mengubah password:{" "}
                                    {passwordError}
                                </p>
                            )}
                        </>
                    )}
            </section>

            <section>
                <h3>Groups</h3>

                <h4>Create Group</h4>

                <form onSubmit={handleCreateGroup}>
                    <div>
                        <label htmlFor="group-name">
                            Name
                        </label>

                        <input
                            id="group-name"
                            type="text"
                            value={createGroupInput.name}
                            onChange={(event) =>
                                setCreateGroupInput({
                                    ...createGroupInput,
                                    name: event.target.value
                                })
                            }
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="group-description">
                            Description
                        </label>

                        <input
                            id="group-description"
                            type="text"
                            value={
                                createGroupInput.description ??
                                ""
                            }
                            onChange={(event) =>
                                setCreateGroupInput({
                                    ...createGroupInput,
                                    description:
                                        event.target.value
                                })
                            }
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={groupCreating}
                    >
                        {groupCreating
                            ? "Creating..."
                            : "Create Group"}
                    </button>

                    {groupCreateError && (
                        <p>
                            Gagal membuat group:{" "}
                            {groupCreateError}
                        </p>
                    )}
                </form>

                {groupsListLoading && (
                    <p>Memuat group...</p>
                )}

                {groupsListError && (
                    <p>
                        Gagal memuat group:{" "}
                        {groupsListError}
                    </p>
                )}

                {!groupsListLoading &&
                    !groupsListError &&
                    groups.length === 0 && (
                        <p>Belum ada group.</p>
                    )}

                {!groupsListLoading &&
                    !groupsListError &&
                    groups.length > 0 && (
                        <>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Description</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {groups.map((group) => (
                                        <Fragment key={group.id}>
                                            <tr>
                                                {editingGroupId ===
                                                group.id ? (
                                                    <>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={
                                                                    editGroupInput.name ??
                                                                    ""
                                                                }
                                                                onChange={(event) =>
                                                                    setEditGroupInput({
                                                                        ...editGroupInput,
                                                                        name:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    })
                                                                }
                                                                required
                                                            />
                                                        </td>

                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={
                                                                    editGroupInput.description ??
                                                                    ""
                                                                }
                                                                onChange={(event) =>
                                                                    setEditGroupInput({
                                                                        ...editGroupInput,
                                                                        description:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    })
                                                                }
                                                            />
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void handleUpdateGroup(
                                                                        group.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    groupUpdating
                                                                }
                                                            >
                                                                {groupUpdating
                                                                    ? "Saving..."
                                                                    : "Save"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    cancelEditingGroup
                                                                }
                                                                disabled={
                                                                    groupUpdating
                                                                }
                                                            >
                                                                Cancel
                                                            </button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>
                                                            {group.name}
                                                        </td>

                                                        <td>
                                                            {group.description ??
                                                                "-"}
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    startEditingGroup(
                                                                        group
                                                                    )
                                                                }
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void startViewingGroupUsers(
                                                                        group
                                                                    )
                                                                }
                                                                disabled={
                                                                    groupUsersLoading
                                                                }
                                                            >
                                                                View Members
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>

                                            {membersEditingGroupId ===
                                                group.id && (
                                                <tr>
                                                    <td colSpan={3}>
                                                        <strong>
                                                            Members
                                                        </strong>

                                                        {groupUsersLoading && (
                                                            <p>
                                                                Memuat member...
                                                            </p>
                                                        )}

                                                        {!groupUsersLoading &&
                                                            !groupUsersError &&
                                                            groupUsers.length ===
                                                                0 && (
                                                                <p>
                                                                    Group belum
                                                                    memiliki
                                                                    member.
                                                                </p>
                                                            )}

                                                        {!groupUsersLoading &&
                                                            !groupUsersError &&
                                                            groupUsers.length >
                                                                0 && (
                                                                <ul>
                                                                    {groupUsers.map(
                                                                        (
                                                                            user
                                                                        ) => (
                                                                            <li
                                                                                key={
                                                                                    user.id
                                                                                }
                                                                            >
                                                                                {
                                                                                    user.name
                                                                                }{" "}
                                                                                (
                                                                                {
                                                                                    user.email
                                                                                }
                                                                                ){" "}
                                                                                -{" "}
                                                                                {
                                                                                    user.status
                                                                                }
                                                                            </li>
                                                                        )
                                                                    )}
                                                                </ul>
                                                            )}

                                                        {groupUsersError && (
                                                            <p>
                                                                Gagal memuat
                                                                member:{" "}
                                                                {
                                                                    groupUsersError
                                                                }
                                                            </p>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={
                                                                stopViewingGroupUsers
                                                            }
                                                        >
                                                            Close
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>

                            {groupEditError && (
                                <p>
                                    Gagal memperbarui group:{" "}
                                    {groupEditError}
                                </p>
                            )}
                        </>
                    )}
            </section>

            <section>
                <h3>Applications</h3>

                <h4>Create Application</h4>

                <form onSubmit={handleCreateApplication}>
                    <div>
                        <label htmlFor="application-name">
                            Name
                        </label>

                        <input
                            id="application-name"
                            type="text"
                            value={
                                createApplicationInput.name
                            }
                            onChange={(event) =>
                                setCreateApplicationInput({
                                    ...createApplicationInput,
                                    name: event.target.value
                                })
                            }
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="application-client-id">
                            Client ID
                        </label>

                        <input
                            id="application-client-id"
                            type="text"
                            value={
                                createApplicationInput.clientId
                            }
                            onChange={(event) =>
                                setCreateApplicationInput({
                                    ...createApplicationInput,
                                    clientId:
                                        event.target.value
                                })
                            }
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="application-launch-url">
                            Launch URL
                        </label>

                        <input
                            id="application-launch-url"
                            type="url"
                            value={
                                createApplicationInput.launchUrl ??
                                ""
                            }
                            onChange={(event) =>
                                setCreateApplicationInput({
                                    ...createApplicationInput,
                                    launchUrl:
                                        event.target.value
                                })
                            }
                        />
                    </div>

                    <div>
                        <label htmlFor="application-logout-url">
                            Logout Notification URL
                        </label>

                        <input
                            id="application-logout-url"
                            type="url"
                            value={
                                createApplicationInput.logoutNotificationUrl
                            }
                            onChange={(event) =>
                                setCreateApplicationInput({
                                    ...createApplicationInput,
                                    logoutNotificationUrl:
                                        event.target.value
                                })
                            }
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={applicationCreating}
                    >
                        {applicationCreating
                            ? "Creating..."
                            : "Create Application"}
                    </button>

                    {applicationCreateError && (
                        <p>
                            Gagal membuat application:{" "}
                            {applicationCreateError}
                        </p>
                    )}
                </form>

                {createdClientSecret && (
                    <div>
                        <p>
                            <strong>
                                Copy this secret now.
                                It will not be shown again.
                            </strong>
                        </p>

                        <p>
                            Application:{" "}
                            {
                                createdClientSecret.applicationName
                            }
                        </p>

                        <p>
                            Client ID:{" "}
                            {createdClientSecret.clientId}
                        </p>

                        <p>
                            Client Secret:{" "}
                            <code>
                                {
                                    createdClientSecret.clientSecret
                                }
                            </code>
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setCreatedClientSecret(
                                    null
                                )
                            }
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {applicationsLoading && (
                    <p>Memuat application...</p>
                )}

                {applicationsError && (
                    <p>
                        Gagal memuat application:{" "}
                        {applicationsError}
                    </p>
                )}

                {!applicationsLoading &&
                    !applicationsError &&
                    applications.length === 0 && (
                        <p>
                            Belum ada application.
                        </p>
                    )}

                {!applicationsLoading &&
                    !applicationsError &&
                    applications.length > 0 && (
                        <>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Client ID</th>
                                        <th>Status</th>
                                        <th>Launch URL</th>
                                        <th>
                                            Logout Notification URL
                                        </th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {applications.map(
                                        (application) => (
                                            <Fragment
                                                key={
                                                    application.id
                                                }
                                            >
                                                <tr>
                                                    {editingApplicationId ===
                                                    application.id ? (
                                                        <>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={
                                                                        editApplicationInput.name ??
                                                                        ""
                                                                    }
                                                                    onChange={(event) =>
                                                                        setEditApplicationInput({
                                                                            ...editApplicationInput,
                                                                            name:
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                        })
                                                                    }
                                                                    required
                                                                />
                                                            </td>

                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={
                                                                        editApplicationInput.clientId ??
                                                                        ""
                                                                    }
                                                                    onChange={(event) =>
                                                                        setEditApplicationInput({
                                                                            ...editApplicationInput,
                                                                            clientId:
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                        })
                                                                    }
                                                                    required
                                                                />
                                                            </td>

                                                            <td>
                                                                {
                                                                    application.status
                                                                }
                                                            </td>

                                                            <td>
                                                                <input
                                                                    type="url"
                                                                    value={
                                                                        editApplicationInput.launchUrl ??
                                                                        ""
                                                                    }
                                                                    onChange={(event) =>
                                                                        setEditApplicationInput({
                                                                            ...editApplicationInput,
                                                                            launchUrl:
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                        })
                                                                    }
                                                                />
                                                            </td>

                                                            <td>
                                                                <input
                                                                    type="url"
                                                                    value={
                                                                        editApplicationInput.logoutNotificationUrl ??
                                                                        ""
                                                                    }
                                                                    onChange={(event) =>
                                                                        setEditApplicationInput({
                                                                            ...editApplicationInput,
                                                                            logoutNotificationUrl:
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                        })
                                                                    }
                                                                    required
                                                                />
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void handleUpdateApplication(
                                                                            application.id
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        applicationUpdating
                                                                    }
                                                                >
                                                                    {applicationUpdating
                                                                        ? "Saving..."
                                                                        : "Save"}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={
                                                                        cancelEditingApplication
                                                                    }
                                                                    disabled={
                                                                        applicationUpdating
                                                                    }
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td>
                                                                {
                                                                    application.name
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    application.clientId
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    application.status
                                                                }
                                                            </td>

                                                            <td>
                                                                {application.launchUrl ??
                                                                    "-"}
                                                            </td>

                                                            <td>
                                                                {
                                                                    application.logoutNotificationUrl
                                                                }
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        startEditingApplication(
                                                                            application
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        statusUpdatingApplicationId ===
                                                                        application.id
                                                                    }
                                                                >
                                                                    Edit
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void handleToggleApplicationStatus(
                                                                            application
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        statusUpdatingApplicationId ===
                                                                        application.id
                                                                    }
                                                                >
                                                                    {statusUpdatingApplicationId ===
                                                                    application.id
                                                                        ? "Updating..."
                                                                        : application.status ===
                                                                            "active"
                                                                          ? "Deactivate"
                                                                          : "Activate"}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void startManagingRedirectUris(
                                                                            application
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        redirectUrisLoading
                                                                    }
                                                                >
                                                                    Manage Redirect URIs
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void startManagingPolicies(
                                                                            application
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        policiesLoading
                                                                    }
                                                                >
                                                                    Manage Policies
                                                                </button>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>

                                                {redirectUrisEditingApplicationId ===
                                                    application.id && (
                                                    <tr>
                                                        <td colSpan={6}>
                                                            <strong>
                                                                Redirect URIs
                                                            </strong>

                                                            {redirectUrisLoading && (
                                                                <p>
                                                                    Memuat redirect URI...
                                                                </p>
                                                            )}

                                                            {!redirectUrisLoading &&
                                                                !redirectUrisError && (
                                                                    <>
                                                                        {applicationRedirectUris.length ===
                                                                        0 ? (
                                                                            <p>
                                                                                Application belum memiliki redirect URI.
                                                                            </p>
                                                                        ) : (
                                                                            <ul>
                                                                                {applicationRedirectUris.map(
                                                                                    (
                                                                                        redirectUri
                                                                                    ) => (
                                                                                        <li
                                                                                            key={
                                                                                                redirectUri.id
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                redirectUri.redirectUri
                                                                                            }{" "}
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    void handleRemoveRedirectUri(
                                                                                                        application.id,
                                                                                                        redirectUri.id
                                                                                                    )
                                                                                                }
                                                                                                disabled={
                                                                                                    redirectUriUpdating
                                                                                                }
                                                                                            >
                                                                                                Remove
                                                                                            </button>
                                                                                        </li>
                                                                                    )
                                                                                )}
                                                                            </ul>
                                                                        )}

                                                                        <div>
                                                                            <input
                                                                                type="url"
                                                                                value={
                                                                                    newRedirectUri
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    setNewRedirectUri(
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                                placeholder="http://localhost:4100/callback"
                                                                                disabled={
                                                                                    redirectUriUpdating
                                                                                }
                                                                            />

                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    void handleAddRedirectUri(
                                                                                        application.id
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    redirectUriUpdating ||
                                                                                    newRedirectUri.trim().length ===
                                                                                        0
                                                                                }
                                                                            >
                                                                                {redirectUriUpdating
                                                                                    ? "Updating..."
                                                                                    : "Add Redirect URI"}
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}

                                                            {redirectUrisError && (
                                                                <p>
                                                                    Gagal mengelola redirect URI:{" "}
                                                                    {
                                                                        redirectUrisError
                                                                    }
                                                                </p>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    stopManagingRedirectUris
                                                                }
                                                                disabled={
                                                                    redirectUriUpdating
                                                                }
                                                            >
                                                                Close
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )}

                                                {policiesEditingApplicationId ===
                                                    application.id && (
                                                    <tr>
                                                        <td colSpan={6}>
                                                            <strong>
                                                                Policies
                                                            </strong>

                                                            {policiesLoading && (
                                                                <p>
                                                                    Memuat policy...
                                                                </p>
                                                            )}

                                                            {!policiesLoading &&
                                                                !policiesError && (
                                                                    <>
                                                                        {applicationPolicies.length ===
                                                                        0 ? (
                                                                            <p>
                                                                                Application belum memiliki allow policy.
                                                                            </p>
                                                                        ) : (
                                                                            <ul>
                                                                                {applicationPolicies.map(
                                                                                    (
                                                                                        policy
                                                                                    ) => {
                                                                                        const group =
                                                                                            groups.find(
                                                                                                (
                                                                                                    currentGroup
                                                                                                ) =>
                                                                                                    currentGroup.id ===
                                                                                                    policy.groupId
                                                                                            );

                                                                                        return (
                                                                                            <li
                                                                                                key={
                                                                                                    policy.id
                                                                                                }
                                                                                            >
                                                                                                {group?.name ??
                                                                                                    policy.groupId}{" "}
                                                                                                -{" "}
                                                                                                {
                                                                                                    policy.effect
                                                                                                }{" "}
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() =>
                                                                                                        void handleRemovePolicy(
                                                                                                            application.id,
                                                                                                            policy.id
                                                                                                        )
                                                                                                    }
                                                                                                    disabled={
                                                                                                        policyUpdating
                                                                                                    }
                                                                                                >
                                                                                                    Remove
                                                                                                </button>
                                                                                            </li>
                                                                                        );
                                                                                    }
                                                                                )}
                                                                            </ul>
                                                                        )}

                                                                        {availablePolicyGroups.length >
                                                                        0 ? (
                                                                            <div>
                                                                                <select
                                                                                    value={
                                                                                        selectedPolicyGroupId
                                                                                    }
                                                                                    onChange={(
                                                                                        event
                                                                                    ) =>
                                                                                        setSelectedPolicyGroupId(
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        policyUpdating
                                                                                    }
                                                                                >
                                                                                    <option value="">
                                                                                        Select group
                                                                                    </option>

                                                                                    {availablePolicyGroups.map(
                                                                                        (
                                                                                            group
                                                                                        ) => (
                                                                                            <option
                                                                                                key={
                                                                                                    group.id
                                                                                                }
                                                                                                value={
                                                                                                    group.id
                                                                                                }
                                                                                            >
                                                                                                {
                                                                                                    group.name
                                                                                                }
                                                                                            </option>
                                                                                        )
                                                                                    )}
                                                                                </select>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        void handleAddPolicy(
                                                                                            application.id
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        policyUpdating ||
                                                                                        selectedPolicyGroupId.length ===
                                                                                            0
                                                                                    }
                                                                                >
                                                                                    {policyUpdating
                                                                                        ? "Updating..."
                                                                                        : "Add Allow Policy"}
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <p>
                                                                                Semua group sudah memiliki allow policy untuk application ini.
                                                                            </p>
                                                                        )}
                                                                    </>
                                                                )}

                                                            {policiesError && (
                                                                <p>
                                                                    Gagal mengelola policy:{" "}
                                                                    {
                                                                        policiesError
                                                                    }
                                                                </p>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    stopManagingPolicies
                                                                }
                                                                disabled={
                                                                    policyUpdating
                                                                }
                                                            >
                                                                Close
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    )}
                                </tbody>
                            </table>

                            {applicationEditError && (
                                <p>
                                    Gagal memperbarui application:{" "}
                                    {applicationEditError}
                                </p>
                            )}

                            {applicationStatusError && (
                                <p>
                                    Gagal mengubah status application:{" "}
                                    {applicationStatusError}
                                </p>
                            )}
                        </>
                    )}
            </section>
        </main>
    );
}

export default App;