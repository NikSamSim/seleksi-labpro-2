import { type FormEvent, useEffect, useState } from "react";

import {
    addApplicationRedirectUri,
    getApplication,
    listApplicationRedirectUris,
    removeApplicationRedirectUri,
    updateApplication,
    updateApplicationStatus
} from "../api/applications";

import {
    createApplicationPolicy,
    listApplicationPoliciesPage,
    removeApplicationPolicy
} from "../api/policies";

import { listGroupsPage } from "../api/groups";

import type {
    Application,
    ApplicationPolicy,
    Group,
    PaginationMeta,
    RedirectUri,
    UpdateApplicationInput
} from "../api/types";

import { Pagination } from "../components/Pagination";

const POLICY_PAGE_SIZE = 20;
const GROUP_PAGE_SIZE = 10;

const initialPolicyPagination: PaginationMeta = {
    page: 1,
    pageSize: POLICY_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0
};

const initialGroupPagination: PaginationMeta = {
    page: 1,
    pageSize: GROUP_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0
};

type ApplicationDetailPageProps = {
    applicationId: string;
    onBack: () => void;
};

export function ApplicationDetailPage({
    applicationId,
    onBack
}: ApplicationDetailPageProps) {
    const [application, setApplication] =
        useState<Application | null>(null);

    const [loadingApplication, setLoadingApplication] =
        useState(true);

    const [applicationError, setApplicationError] =
        useState<string | null>(null);

    const [editInput, setEditInput] =
        useState<UpdateApplicationInput>({});

    const [updatingApplication, setUpdatingApplication] =
        useState(false);

    const [updateError, setUpdateError] =
        useState<string | null>(null);

    const [updatingStatus, setUpdatingStatus] =
        useState(false);

    const [statusError, setStatusError] =
        useState<string | null>(null);

    const [redirectUris, setRedirectUris] =
        useState<RedirectUri[]>([]);

    const [redirectUrisLoading, setRedirectUrisLoading] =
        useState(true);

    const [redirectUrisError, setRedirectUrisError] =
        useState<string | null>(null);

    const [newRedirectUri, setNewRedirectUri] =
        useState("");

    const [redirectUriUpdating, setRedirectUriUpdating] =
        useState(false);

    const [policies, setPolicies] =
        useState<ApplicationPolicy[]>([]);

    const [policyPagination, setPolicyPagination] =
        useState<PaginationMeta>(initialPolicyPagination);

    const [policyPage, setPolicyPage] =
        useState(1);

    const [policySearchInput, setPolicySearchInput] =
        useState("");

    const [policySearch, setPolicySearch] =
        useState("");

    const [policiesLoading, setPoliciesLoading] =
        useState(true);

    const [policiesError, setPoliciesError] =
        useState<string | null>(null);

    const [policyRefreshKey, setPolicyRefreshKey] =
        useState(0);

    const [policyUpdatingId, setPolicyUpdatingId] =
        useState<string | null>(null);

    const [groupSearchInput, setGroupSearchInput] =
        useState("");

    const [groupSearch, setGroupSearch] =
        useState("");

    const [groupPage, setGroupPage] =
        useState(1);

    const [groupResults, setGroupResults] =
        useState<Group[]>([]);

    const [groupPagination, setGroupPagination] =
        useState<PaginationMeta>(initialGroupPagination);

    const [groupsLoading, setGroupsLoading] =
        useState(true);

    const [groupsError, setGroupsError] =
        useState<string | null>(null);

    const [addingPolicyGroupId, setAddingPolicyGroupId] =
        useState<string | null>(null);

    const [addPolicyError, setAddPolicyError] =
        useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadApplication() {
            setLoadingApplication(true);
            setApplicationError(null);

            try {
                const loadedApplication =
                    await getApplication(applicationId);

                if (cancelled) {
                    return;
                }

                setApplication(loadedApplication);

                setEditInput({
                    name: loadedApplication.name,
                    clientId: loadedApplication.clientId,
                    launchUrl: loadedApplication.launchUrl ?? "",
                    logoutNotificationUrl:
                        loadedApplication.logoutNotificationUrl
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setApplicationError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil detail application"
                );
            } finally {
                if (!cancelled) {
                    setLoadingApplication(false);
                }
            }
        }

        void loadApplication();

        return () => {
            cancelled = true;
        };
    }, [applicationId]);

    useEffect(() => {
        let cancelled = false;

        async function loadRedirectUris() {
            setRedirectUrisLoading(true);
            setRedirectUrisError(null);

            try {
                const loadedRedirectUris =
                    await listApplicationRedirectUris(applicationId);

                if (cancelled) {
                    return;
                }

                setRedirectUris(loadedRedirectUris);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setRedirectUrisError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil redirect URI"
                );
            } finally {
                if (!cancelled) {
                    setRedirectUrisLoading(false);
                }
            }
        }

        void loadRedirectUris();

        return () => {
            cancelled = true;
        };
    }, [applicationId]);

    useEffect(() => {
        let cancelled = false;

        async function loadPolicies() {
            setPoliciesLoading(true);
            setPoliciesError(null);

            try {
                const result =
                    await listApplicationPoliciesPage(
                        applicationId,
                        {
                            page: policyPage,
                            pageSize: POLICY_PAGE_SIZE,
                            search: policySearch || undefined
                        }
                    );

                if (cancelled) {
                    return;
                }

                setPolicies(result.items);
                setPolicyPagination(result.pagination);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setPoliciesError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil policy application"
                );
            } finally {
                if (!cancelled) {
                    setPoliciesLoading(false);
                }
            }
        }

        void loadPolicies();

        return () => {
            cancelled = true;
        };
    }, [
        applicationId,
        policyPage,
        policyRefreshKey,
        policySearch
    ]);

    useEffect(() => {
        let cancelled = false;

        async function loadGroups() {
            setGroupsLoading(true);
            setGroupsError(null);

            try {
                const result = await listGroupsPage({
                    page: groupPage,
                    pageSize: GROUP_PAGE_SIZE,
                    search: groupSearch || undefined
                });

                if (cancelled) {
                    return;
                }

                setGroupResults(result.items);
                setGroupPagination(result.pagination);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setGroupsError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil group"
                );
            } finally {
                if (!cancelled) {
                    setGroupsLoading(false);
                }
            }
        }

        void loadGroups();

        return () => {
            cancelled = true;
        };
    }, [groupPage, groupSearch]);

    async function handleUpdateApplication(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setUpdatingApplication(true);
        setUpdateError(null);

        try {
            const updatedApplication =
                await updateApplication(applicationId, {
                    name: editInput.name,
                    clientId: editInput.clientId,
                    launchUrl: editInput.launchUrl?.trim()
                        ? editInput.launchUrl
                        : null,
                    logoutNotificationUrl:
                        editInput.logoutNotificationUrl
                });

            setApplication(updatedApplication);

            setEditInput({
                name: updatedApplication.name,
                clientId: updatedApplication.clientId,
                launchUrl: updatedApplication.launchUrl ?? "",
                logoutNotificationUrl:
                    updatedApplication.logoutNotificationUrl
            });
        } catch (error) {
            setUpdateError(
                error instanceof Error
                    ? error.message
                    : "Gagal memperbarui application"
            );
        } finally {
            setUpdatingApplication(false);
        }
    }

    async function handleToggleStatus() {
        if (!application) {
            return;
        }

        setUpdatingStatus(true);
        setStatusError(null);

        try {
            const updatedApplication =
                await updateApplicationStatus(
                    applicationId,
                    {
                        status:
                            application.status === "active"
                                ? "inactive"
                                : "active"
                    }
                );

            setApplication(updatedApplication);
        } catch (error) {
            setStatusError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengubah status application"
            );
        } finally {
            setUpdatingStatus(false);
        }
    }

    async function handleAddRedirectUri(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        const redirectUriValue =
            newRedirectUri.trim();

        if (!redirectUriValue) {
            return;
        }

        setRedirectUriUpdating(true);
        setRedirectUrisError(null);

        try {
            const redirectUri =
                await addApplicationRedirectUri(
                    applicationId,
                    {
                        redirectUri:
                            redirectUriValue
                    }
                );

            setRedirectUris((current) => [
                ...current,
                redirectUri
            ]);

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
        redirectUriId: string
    ) {
        setRedirectUriUpdating(true);
        setRedirectUrisError(null);

        try {
            await removeApplicationRedirectUri(
                applicationId,
                redirectUriId
            );

            setRedirectUris((current) =>
                current.filter(
                    (redirectUri) =>
                        redirectUri.id !== redirectUriId
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

    function handlePolicySearch(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setPolicyPage(1);
        setPolicySearch(
            policySearchInput.trim()
        );
    }

    function handleClearPolicySearch() {
        setPolicySearchInput("");
        setPolicySearch("");
        setPolicyPage(1);
    }

    async function handleRemovePolicy(
        policyId: string
    ) {
        setPolicyUpdatingId(policyId);
        setPoliciesError(null);

        try {
            await removeApplicationPolicy(
                applicationId,
                policyId
            );

            if (
                policies.length === 1 &&
                policyPage > 1
            ) {
                setPolicyPage(
                    (current) =>
                        current - 1
                );
            } else {
                setPolicyRefreshKey(
                    (current) =>
                        current + 1
                );
            }
        } catch (error) {
            setPoliciesError(
                error instanceof Error
                    ? error.message
                    : "Gagal menghapus policy"
            );
        } finally {
            setPolicyUpdatingId(null);
        }
    }

    function handleGroupSearch(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setGroupPage(1);
        setGroupSearch(
            groupSearchInput.trim()
        );
    }

    async function handleAddPolicy(
        groupId: string
    ) {
        setAddingPolicyGroupId(groupId);
        setAddPolicyError(null);

        try {
            await createApplicationPolicy(
                applicationId,
                {
                    groupId,
                    effect: "allow"
                }
            );

            setPolicyPage(1);
            setPolicySearchInput("");
            setPolicySearch("");
            setPolicyRefreshKey(
                (current) =>
                    current + 1
            );
        } catch (error) {
            setAddPolicyError(
                error instanceof Error
                    ? error.message
                    : "Gagal menambahkan policy"
            );
        } finally {
            setAddingPolicyGroupId(null);
        }
    }

    return (
        <section>
            <button
                type="button"
                onClick={onBack}
            >
                ← Back to Applications
            </button>

            <h3>Application Detail</h3>

            {loadingApplication && (
                <p>
                    Memuat detail application...
                </p>
            )}

            {applicationError && (
                <p>
                    Gagal memuat detail application:{" "}
                    {applicationError}
                </p>
            )}

            {!loadingApplication &&
                !applicationError &&
                application && (
                    <>
                        <section>
                            <h4>
                                Client Configuration
                            </h4>

                            <p>
                                Status:{" "}
                                <strong>
                                    {application.status}
                                </strong>
                            </p>

                            <form
                                onSubmit={
                                    handleUpdateApplication
                                }
                            >
                                <div>
                                    <label
                                        htmlFor="detail-application-name"
                                    >
                                        Name
                                    </label>

                                    <input
                                        id="detail-application-name"
                                        type="text"
                                        value={
                                            editInput.name ??
                                            ""
                                        }
                                        onChange={(event) =>
                                            setEditInput({
                                                ...editInput,
                                                name:
                                                    event.target.value
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="detail-application-client-id"
                                    >
                                        Client ID
                                    </label>

                                    <input
                                        id="detail-application-client-id"
                                        type="text"
                                        value={
                                            editInput.clientId ??
                                            ""
                                        }
                                        onChange={(event) =>
                                            setEditInput({
                                                ...editInput,
                                                clientId:
                                                    event.target.value
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="detail-application-launch-url"
                                    >
                                        Launch URL
                                    </label>

                                    <input
                                        id="detail-application-launch-url"
                                        type="url"
                                        value={
                                            editInput.launchUrl ??
                                            ""
                                        }
                                        onChange={(event) =>
                                            setEditInput({
                                                ...editInput,
                                                launchUrl:
                                                    event.target.value
                                            })
                                        }
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="detail-application-logout-url"
                                    >
                                        Logout Notification URL
                                    </label>

                                    <input
                                        id="detail-application-logout-url"
                                        type="url"
                                        value={
                                            editInput.logoutNotificationUrl ??
                                            ""
                                        }
                                        onChange={(event) =>
                                            setEditInput({
                                                ...editInput,
                                                logoutNotificationUrl:
                                                    event.target.value
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={
                                        updatingApplication
                                    }
                                >
                                    {updatingApplication
                                        ? "Saving..."
                                        : "Save Application"}
                                </button>
                            </form>

                            {updateError && (
                                <p>
                                    Gagal memperbarui application:{" "}
                                    {updateError}
                                </p>
                            )}
                        </section>

                        <section>
                            <h4>Status</h4>

                            <button
                                type="button"
                                disabled={updatingStatus}
                                onClick={() =>
                                    void handleToggleStatus()
                                }
                            >
                                {updatingStatus
                                    ? "Updating..."
                                    : application.status ===
                                        "active"
                                      ? "Deactivate Application"
                                      : "Activate Application"}
                            </button>

                            {statusError && (
                                <p>
                                    Gagal mengubah status:{" "}
                                    {statusError}
                                </p>
                            )}
                        </section>

                        <section>
                            <h4>Redirect URIs</h4>

                            {redirectUrisLoading && (
                                <p>
                                    Memuat redirect URI...
                                </p>
                            )}

                            {!redirectUrisLoading &&
                                redirectUris.length ===
                                    0 && (
                                    <p>
                                        Belum ada redirect
                                        URI.
                                    </p>
                                )}

                            {!redirectUrisLoading &&
                                redirectUris.length >
                                    0 && (
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>
                                                    Redirect URI
                                                </th>
                                                <th>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {redirectUris.map(
                                                (redirectUri) => (
                                                    <tr
                                                        key={
                                                            redirectUri.id
                                                        }
                                                    >
                                                        <td>
                                                            {
                                                                redirectUri.redirectUri
                                                            }
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    redirectUriUpdating
                                                                }
                                                                onClick={() =>
                                                                    void handleRemoveRedirectUri(
                                                                        redirectUri.id
                                                                    )
                                                                }
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                )}

                            <form
                                onSubmit={
                                    handleAddRedirectUri
                                }
                            >
                                <input
                                    type="url"
                                    placeholder="http://localhost:4000/callback"
                                    value={newRedirectUri}
                                    onChange={(event) =>
                                        setNewRedirectUri(
                                            event.target.value
                                        )
                                    }
                                    required
                                />{" "}

                                <button
                                    type="submit"
                                    disabled={
                                        redirectUriUpdating
                                    }
                                >
                                    {redirectUriUpdating
                                        ? "Updating..."
                                        : "Add Redirect URI"}
                                </button>
                            </form>

                            {redirectUrisError && (
                                <p>
                                    Gagal mengelola redirect
                                    URI:{" "}
                                    {redirectUrisError}
                                </p>
                            )}
                        </section>

                        <section>
                            <h4>Policies</h4>

                            <form
                                onSubmit={
                                    handlePolicySearch
                                }
                            >
                                <input
                                    type="search"
                                    placeholder="Search group name"
                                    value={
                                        policySearchInput
                                    }
                                    onChange={(event) =>
                                        setPolicySearchInput(
                                            event.target.value
                                        )
                                    }
                                />{" "}

                                <button
                                    type="submit"
                                    disabled={
                                        policiesLoading
                                    }
                                >
                                    Search
                                </button>{" "}

                                <button
                                    type="button"
                                    disabled={
                                        policiesLoading
                                    }
                                    onClick={
                                        handleClearPolicySearch
                                    }
                                >
                                    Clear
                                </button>
                            </form>

                            {policiesLoading && (
                                <p>
                                    Memuat policy...
                                </p>
                            )}

                            {policiesError && (
                                <p>
                                    Gagal memuat policy:{" "}
                                    {policiesError}
                                </p>
                            )}

                            {!policiesLoading &&
                                !policiesError &&
                                policies.length ===
                                    0 && (
                                    <p>
                                        Tidak ada policy
                                        yang cocok.
                                    </p>
                                )}

                            {!policiesLoading &&
                                !policiesError &&
                                policies.length >
                                    0 && (
                                    <>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>
                                                        Group
                                                    </th>
                                                    <th>
                                                        Effect
                                                    </th>
                                                    <th>
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {policies.map(
                                                    (policy) => (
                                                        <tr
                                                            key={
                                                                policy.id
                                                            }
                                                        >
                                                            <td>
                                                                {
                                                                    policy.groupName
                                                                }
                                                            </td>
                                                            <td>
                                                                {
                                                                    policy.effect
                                                                }
                                                            </td>
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        policyUpdatingId ===
                                                                        policy.id
                                                                    }
                                                                    onClick={() =>
                                                                        void handleRemovePolicy(
                                                                            policy.id
                                                                        )
                                                                    }
                                                                >
                                                                    {policyUpdatingId ===
                                                                    policy.id
                                                                        ? "Removing..."
                                                                        : "Remove"}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>

                                        <Pagination
                                            pagination={
                                                policyPagination
                                            }
                                            disabled={
                                                policiesLoading
                                            }
                                            onPageChange={
                                                setPolicyPage
                                            }
                                        />
                                    </>
                                )}

                            <h5>Add Allow Policy</h5>

                            <form
                                onSubmit={
                                    handleGroupSearch
                                }
                            >
                                <input
                                    type="search"
                                    placeholder="Search group"
                                    value={
                                        groupSearchInput
                                    }
                                    onChange={(event) =>
                                        setGroupSearchInput(
                                            event.target.value
                                        )
                                    }
                                />{" "}

                                <button
                                    type="submit"
                                    disabled={
                                        groupsLoading
                                    }
                                >
                                    Search
                                </button>
                            </form>

                            {groupsLoading && (
                                <p>
                                    Memuat group...
                                </p>
                            )}

                            {groupsError && (
                                <p>
                                    Gagal memuat group:{" "}
                                    {groupsError}
                                </p>
                            )}

                            {!groupsLoading &&
                                !groupsError &&
                                groupResults.length ===
                                    0 && (
                                    <p>
                                        Tidak ada group
                                        yang cocok.
                                    </p>
                                )}

                            {!groupsLoading &&
                                !groupsError &&
                                groupResults.length >
                                    0 && (
                                    <>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>
                                                        Group
                                                    </th>
                                                    <th>
                                                        Description
                                                    </th>
                                                    <th>
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {groupResults.map(
                                                    (group) => (
                                                        <tr
                                                            key={
                                                                group.id
                                                            }
                                                        >
                                                            <td>
                                                                {
                                                                    group.name
                                                                }
                                                            </td>

                                                            <td>
                                                                {group.description ??
                                                                    "-"}
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        addingPolicyGroupId ===
                                                                        group.id
                                                                    }
                                                                    onClick={() =>
                                                                        void handleAddPolicy(
                                                                            group.id
                                                                        )
                                                                    }
                                                                >
                                                                    {addingPolicyGroupId ===
                                                                    group.id
                                                                        ? "Adding..."
                                                                        : "Add Allow Policy"}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>

                                        <Pagination
                                            pagination={
                                                groupPagination
                                            }
                                            disabled={
                                                groupsLoading
                                            }
                                            onPageChange={
                                                setGroupPage
                                            }
                                        />
                                    </>
                                )}

                            {addPolicyError && (
                                <p>
                                    Gagal menambahkan policy:{" "}
                                    {addPolicyError}
                                </p>
                            )}
                        </section>
                    </>
                )}
        </section>
    );
}