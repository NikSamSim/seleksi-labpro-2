import {
    type FormEvent,
    useEffect,
    useState
} from "react";

import {
    addUserToGroup,
    listGroupsPage,
    listUserGroups,
    removeUserFromGroup
} from "../api/groups";

import {
    getUser,
    getUserMfaStatus,
    resetUserMfa,
    updateUser,
    updateUserPassword,
    updateUserStatus
} from "../api/users";

import type {
    Group,
    PaginationMeta,
    UpdateUserInput,
    UserMfaStatus,
    User
} from "../api/types";

import {
    Pagination
} from "../components/Pagination";

const GROUP_PAGE_SIZE = 10;

const initialGroupPagination:
    PaginationMeta = {
        page: 1,
        pageSize:
            GROUP_PAGE_SIZE,
        totalItems: 0,
        totalPages: 0
    };

type UserDetailPageProps = {
    userId: string;
    onBack: () => void;
};

export function UserDetailPage({
    userId,
    onBack
}: UserDetailPageProps) {
    const [user, setUser] =
        useState<User | null>(
            null
        );

    const [
        memberships,
        setMemberships
    ] = useState<Group[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(
            null
        );

    const [
        editInput,
        setEditInput
    ] = useState<
        UpdateUserInput
    >({});

    const [
        updatingProfile,
        setUpdatingProfile
    ] = useState(false);

    const [
        profileError,
        setProfileError
    ] = useState<
        string | null
    >(null);

    const [
        updatingStatus,
        setUpdatingStatus
    ] = useState(false);

    const [
        statusError,
        setStatusError
    ] = useState<
        string | null
    >(null);

    const [
        newPassword,
        setNewPassword
    ] = useState("");

    const [
        updatingPassword,
        setUpdatingPassword
    ] = useState(false);

    const [
        passwordError,
        setPasswordError
    ] = useState<
        string | null
    >(null);

    const [
        passwordMessage,
        setPasswordMessage
    ] = useState<
        string | null
    >(null);

    const [mfaStatus, setMfaStatus] = useState<UserMfaStatus | null>(null);
    const [resettingMfa, setResettingMfa] = useState(false);
    const [mfaError, setMfaError] = useState<string | null>(null);
    const [mfaMessage, setMfaMessage] = useState<string | null>(null);

    const [
        groupSearchInput,
        setGroupSearchInput
    ] = useState("");

    const [
        groupSearch,
        setGroupSearch
    ] = useState("");

    const [
        groupPage,
        setGroupPage
    ] = useState(1);

    const [
        groupResults,
        setGroupResults
    ] = useState<Group[]>([]);

    const [
        groupPagination,
        setGroupPagination
    ] = useState<
        PaginationMeta
    >(
        initialGroupPagination
    );

    const [
        groupSearchLoading,
        setGroupSearchLoading
    ] = useState(false);

    const [
        groupSearchError,
        setGroupSearchError
    ] = useState<
        string | null
    >(null);

    const [
        membershipUpdatingGroupId,
        setMembershipUpdatingGroupId
    ] = useState<
        string | null
    >(null);

    const [
        membershipError,
        setMembershipError
    ] = useState<
        string | null
    >(null);

    useEffect(() => {
        let cancelled =
            false;

        async function loadDetail() {
            setLoading(true);
            setError(null);

            try {
                const [
                    loadedUser,
                    loadedMemberships,
                    loadedMfaStatus
                ] = await Promise.all([
                    getUser(userId),
                    listUserGroups(userId),
                    getUserMfaStatus(userId)
                ]);

                if (cancelled) {
                    return;
                }

                setUser(
                    loadedUser
                );

                setMemberships(
                    loadedMemberships
                );

                setMfaStatus(loadedMfaStatus);

                setEditInput({
                    name:
                        loadedUser.name,
                    email:
                        loadedUser.email
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setError(
                    error instanceof
                    Error
                        ? error.message
                        : "Gagal mengambil detail user"
                );
            } finally {
                if (!cancelled) {
                    setLoading(
                        false
                    );
                }
            }
        }

        void loadDetail();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    useEffect(() => {
        let cancelled =
            false;

        async function loadGroupResults() {
            setGroupSearchLoading(
                true
            );

            setGroupSearchError(
                null
            );

            try {
                const result =
                    await listGroupsPage({
                        page:
                            groupPage,
                        pageSize:
                            GROUP_PAGE_SIZE,
                        search:
                            groupSearch ||
                            undefined
                    });

                if (cancelled) {
                    return;
                }

                setGroupResults(
                    result.items
                );

                setGroupPagination(
                    result.pagination
                );
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setGroupSearchError(
                    error instanceof
                    Error
                        ? error.message
                        : "Gagal mengambil daftar group"
                );
            } finally {
                if (!cancelled) {
                    setGroupSearchLoading(
                        false
                    );
                }
            }
        }

        void loadGroupResults();

        return () => {
            cancelled = true;
        };
    }, [
        groupPage,
        groupSearch
    ]);

    async function handleUpdateProfile(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setUpdatingProfile(
            true
        );

        setProfileError(
            null
        );

        try {
            const updatedUser =
                await updateUser(
                    userId,
                    editInput
                );

            setUser(
                updatedUser
            );

            setEditInput({
                name:
                    updatedUser.name,
                email:
                    updatedUser.email
            });
        } catch (error) {
            setProfileError(
                error instanceof
                Error
                    ? error.message
                    : "Gagal memperbarui user"
            );
        } finally {
            setUpdatingProfile(
                false
            );
        }
    }

    async function handleToggleStatus() {
        if (!user) {
            return;
        }

        setUpdatingStatus(
            true
        );

        setStatusError(
            null
        );

        try {
            const updatedUser =
                await updateUserStatus(
                    userId,
                    {
                        status:
                            user.status ===
                            "active"
                                ? "inactive"
                                : "active"
                    }
                );

            setUser(
                updatedUser
            );
        } catch (error) {
            setStatusError(
                error instanceof
                Error
                    ? error.message
                    : "Gagal mengubah status user"
            );
        } finally {
            setUpdatingStatus(
                false
            );
        }
    }

    async function handleChangePassword(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setUpdatingPassword(
            true
        );

        setPasswordError(
            null
        );

        setPasswordMessage(
            null
        );

        try {
            await updateUserPassword(
                userId,
                {
                    password:
                        newPassword
                }
            );

            setNewPassword(
                ""
            );

            setPasswordMessage(
                "Password berhasil diperbarui."
            );
        } catch (error) {
            setPasswordError(
                error instanceof
                Error
                    ? error.message
                    : "Gagal mengubah password"
            );
        } finally {
            setUpdatingPassword(
                false
            );
        }
    }

    async function handleResetMfa() {
        if (!mfaStatus?.enabled) {
            return;
        }

        const confirmed = window.confirm(
            "Reset MFA user ini? Authenticator dan seluruh recovery code akan dihapus, dan semua session user akan dicabut."
        );

        if (!confirmed) {
            return;
        }

        setResettingMfa(true);
        setMfaError(null);
        setMfaMessage(null);

        try {
            const result = await resetUserMfa(userId);
            setMfaStatus(result.mfa);

            setMfaMessage(
                result.reset.changed
                    ? "MFA berhasil di-reset. Seluruh session user telah dicabut."
                    : "MFA user sudah tidak aktif."
            );
        } catch (error) {
            setMfaError(
                error instanceof Error
                    ? error.message
                    : "Gagal me-reset MFA"
            );
        } finally {
            setResettingMfa(false);
        }
    }

    function handleGroupSearch(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setGroupPage(1);

        setGroupSearch(
            groupSearchInput.trim()
        );
    }

    function isMember(
        groupId: string
    ) {
        return memberships.some(
            (group) =>
                group.id ===
                groupId
        );
    }

    async function handleAddMembership(
        group: Group
    ) {
        setMembershipUpdatingGroupId(
            group.id
        );

        setMembershipError(
            null
        );

        try {
            await addUserToGroup(
                userId,
                group.id
            );

            setMemberships(
                (current) => [
                    ...current,
                    group
                ]
            );
        } catch (error) {
            setMembershipError(
                error instanceof
                Error
                    ? error.message
                    : "Gagal menambahkan membership"
            );
        } finally {
            setMembershipUpdatingGroupId(
                null
            );
        }
    }

    async function handleRemoveMembership(
        groupId: string
    ) {
        setMembershipUpdatingGroupId(
            groupId
        );

        setMembershipError(
            null
        );

        try {
            await removeUserFromGroup(
                userId,
                groupId
            );

            setMemberships(
                (current) =>
                    current.filter(
                        (group) =>
                            group.id !==
                            groupId
                    )
            );
        } catch (error) {
            setMembershipError(
                error instanceof
                Error
                    ? error.message
                    : "Gagal menghapus membership"
            );
        } finally {
            setMembershipUpdatingGroupId(
                null
            );
        }
    }

    return (
        <section>
            <button
                type="button"
                onClick={onBack}
            >
                ← Back to Users
            </button>

            <h3>
                User Detail
            </h3>

            {loading && (
                <p>
                    Memuat detail
                    user...
                </p>
            )}

            {error && (
                <p>
                    Gagal memuat
                    detail user:{" "}
                    {error}
                </p>
            )}

            {!loading &&
                !error &&
                user && (
                    <>
                        <section>
                            <h4>
                                Profile
                            </h4>

                            <p>
                                Status:{" "}
                                <strong>
                                    {
                                        user.status
                                    }
                                </strong>
                            </p>

                            <form
                                onSubmit={
                                    handleUpdateProfile
                                }
                            >
                                <div>
                                    <label
                                        htmlFor="detail-user-name"
                                    >
                                        Name
                                    </label>

                                    <input
                                        id="detail-user-name"
                                        type="text"
                                        value={
                                            editInput.name ??
                                            ""
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setEditInput({
                                                ...editInput,
                                                name:
                                                    event
                                                        .target
                                                        .value
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="detail-user-email"
                                    >
                                        Email
                                    </label>

                                    <input
                                        id="detail-user-email"
                                        type="email"
                                        value={
                                            editInput.email ??
                                            ""
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setEditInput({
                                                ...editInput,
                                                email:
                                                    event
                                                        .target
                                                        .value
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={
                                        updatingProfile
                                    }
                                >
                                    {updatingProfile
                                        ? "Saving..."
                                        : "Save Profile"}
                                </button>
                            </form>

                            {profileError && (
                                <p>
                                    Gagal
                                    memperbarui
                                    profile:{" "}
                                    {
                                        profileError
                                    }
                                </p>
                            )}
                        </section>

                        <section>
                            <h4>
                                Status
                            </h4>

                            <button
                                type="button"
                                onClick={() =>
                                    void handleToggleStatus()
                                }
                                disabled={
                                    updatingStatus
                                }
                            >
                                {updatingStatus
                                    ? "Updating..."
                                    : user.status ===
                                        "active"
                                      ? "Deactivate User"
                                      : "Activate User"}
                            </button>

                            {statusError && (
                                <p>
                                    Gagal
                                    mengubah
                                    status:{" "}
                                    {
                                        statusError
                                    }
                                </p>
                            )}
                        </section>

                        <section>
                            <h4>
                                Change Password
                            </h4>

                            <form
                                onSubmit={
                                    handleChangePassword
                                }
                            >
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
                                    required
                                />{" "}

                                <button
                                    type="submit"
                                    disabled={
                                        updatingPassword
                                    }
                                >
                                    {updatingPassword
                                        ? "Updating..."
                                        : "Change Password"}
                                </button>
                            </form>

                            {passwordMessage && (
                                <p>
                                    {
                                        passwordMessage
                                    }
                                </p>
                            )}

                            {passwordError && (
                                <p>
                                    Gagal
                                    mengubah
                                    password:{" "}
                                    {
                                        passwordError
                                    }
                                </p>
                            )}
                        </section>

                        <section>
                            <h4>MFA</h4>

                            {mfaStatus === null ? (
                                <p>Memuat status MFA...</p>
                            ) : (
                                <>
                                    <p>
                                        Status:{" "}
                                        <strong>
                                            {mfaStatus.enabled
                                                ? "Enabled"
                                                : "Disabled"}
                                        </strong>
                                    </p>

                                    {mfaStatus.enabledAt && (
                                        <p>
                                            Enabled at:{" "}
                                            {new Date(
                                                mfaStatus.enabledAt
                                            ).toLocaleString()}
                                        </p>
                                    )}

                                    {mfaStatus.enabled && (
                                        <>
                                            <p>
                                                Reset MFA akan menghapus
                                                authenticator dan seluruh
                                                recovery code user, serta
                                                mencabut semua session.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleResetMfa()
                                                }
                                                disabled={resettingMfa}
                                            >
                                                {resettingMfa
                                                    ? "Resetting..."
                                                    : "Reset MFA"}
                                            </button>
                                        </>
                                    )}
                                </>
                            )}

                            {mfaMessage && <p>{mfaMessage}</p>}
                            {mfaError && (
                                <p>
                                    Gagal me-reset MFA: {mfaError}
                                </p>
                            )}
                        </section>

                        <section>
                            <h4>
                                Memberships
                            </h4>

                            {memberships.length ===
                            0 ? (
                                <p>
                                    User belum
                                    berada di
                                    group mana
                                    pun.
                                </p>
                            ) : (
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
                                        {memberships.map(
                                            (
                                                group
                                            ) => (
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
                                                                membershipUpdatingGroupId ===
                                                                group.id
                                                            }
                                                            onClick={() =>
                                                                void handleRemoveMembership(
                                                                    group.id
                                                                )
                                                            }
                                                        >
                                                            {membershipUpdatingGroupId ===
                                                            group.id
                                                                ? "Updating..."
                                                                : "Remove"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            )}

                            <h5>
                                Add Membership
                            </h5>

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
                                    onChange={(
                                        event
                                    ) =>
                                        setGroupSearchInput(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                />{" "}

                                <button
                                    type="submit"
                                    disabled={
                                        groupSearchLoading
                                    }
                                >
                                    Search
                                </button>
                            </form>

                            {groupSearchLoading && (
                                <p>
                                    Memuat
                                    group...
                                </p>
                            )}

                            {groupSearchError && (
                                <p>
                                    Gagal
                                    memuat
                                    group:{" "}
                                    {
                                        groupSearchError
                                    }
                                </p>
                            )}

                            {!groupSearchLoading &&
                                !groupSearchError &&
                                groupResults.length >
                                    0 && (
                                    <>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>
                                                        Name
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
                                                    (
                                                        group
                                                    ) => (
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
                                                                {isMember(
                                                                    group.id
                                                                ) ? (
                                                                    <span>
                                                                        Member
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            membershipUpdatingGroupId ===
                                                                            group.id
                                                                        }
                                                                        onClick={() =>
                                                                            void handleAddMembership(
                                                                                group
                                                                            )
                                                                        }
                                                                    >
                                                                        {membershipUpdatingGroupId ===
                                                                        group.id
                                                                            ? "Updating..."
                                                                            : "Add"}
                                                                    </button>
                                                                )}
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
                                                groupSearchLoading
                                            }
                                            onPageChange={
                                                setGroupPage
                                            }
                                        />
                                    </>
                                )}

                            {membershipError && (
                                <p>
                                    Gagal
                                    mengubah
                                    membership:{" "}
                                    {
                                        membershipError
                                    }
                                </p>
                            )}
                        </section>
                    </>
                )}
        </section>
    );
}