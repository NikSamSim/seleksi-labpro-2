import { type FormEvent, useEffect, useState } from "react";

import {
    getGroup,
    listGroupUsersPage,
    removeUserFromGroup,
    updateGroup
} from "../api/groups";

import type {
    Group,
    PaginationMeta,
    UpdateGroupInput,
    User,
    UserStatus
} from "../api/types";

import { Pagination } from "../components/Pagination";

const MEMBER_PAGE_SIZE = 20;

const initialMemberPagination: PaginationMeta = {
    page: 1,
    pageSize: MEMBER_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0
};

type GroupDetailPageProps = {
    groupId: string;
    onBack: () => void;
};

export function GroupDetailPage({
    groupId,
    onBack
}: GroupDetailPageProps) {
    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);
    const [groupError, setGroupError] = useState<string | null>(null);

    const [editInput, setEditInput] = useState<UpdateGroupInput>({});
    const [updatingGroup, setUpdatingGroup] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    const [members, setMembers] = useState<User[]>([]);
    const [memberPagination, setMemberPagination] =
        useState<PaginationMeta>(initialMemberPagination);

    const [memberPage, setMemberPage] = useState(1);
    const [memberSearchInput, setMemberSearchInput] = useState("");
    const [memberSearch, setMemberSearch] = useState("");
    const [memberStatus, setMemberStatus] = useState<UserStatus | "">("");

    const [membersLoading, setMembersLoading] = useState(true);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [memberRefreshKey, setMemberRefreshKey] = useState(0);

    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [membershipError, setMembershipError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadGroup() {
            setLoadingGroup(true);
            setGroupError(null);

            try {
                const loadedGroup = await getGroup(groupId);

                if (cancelled) {
                    return;
                }

                setGroup(loadedGroup);
                setEditInput({
                    name: loadedGroup.name,
                    description: loadedGroup.description
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setGroupError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil detail group"
                );
            } finally {
                if (!cancelled) {
                    setLoadingGroup(false);
                }
            }
        }

        void loadGroup();

        return () => {
            cancelled = true;
        };
    }, [groupId]);

    useEffect(() => {
        let cancelled = false;

        async function loadMembers() {
            setMembersLoading(true);
            setMembersError(null);

            try {
                const result = await listGroupUsersPage(groupId, {
                    page: memberPage,
                    pageSize: MEMBER_PAGE_SIZE,
                    search: memberSearch || undefined,
                    status: memberStatus || undefined
                });

                if (cancelled) {
                    return;
                }

                setMembers(result.items);
                setMemberPagination(result.pagination);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setMembersError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil member group"
                );
            } finally {
                if (!cancelled) {
                    setMembersLoading(false);
                }
            }
        }

        void loadMembers();

        return () => {
            cancelled = true;
        };
    }, [
        groupId,
        memberPage,
        memberRefreshKey,
        memberSearch,
        memberStatus
    ]);

    async function handleUpdateGroup(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setUpdatingGroup(true);
        setUpdateError(null);

        try {
            const updatedGroup = await updateGroup(groupId, {
                name: editInput.name,
                description: editInput.description?.trim() || null
            });

            setGroup(updatedGroup);
            setEditInput({
                name: updatedGroup.name,
                description: updatedGroup.description
            });
        } catch (error) {
            setUpdateError(
                error instanceof Error
                    ? error.message
                    : "Gagal memperbarui group"
            );
        } finally {
            setUpdatingGroup(false);
        }
    }

    function handleMemberSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setMemberPage(1);
        setMemberSearch(memberSearchInput.trim());
    }

    function handleClearMemberFilters() {
        setMemberSearchInput("");
        setMemberSearch("");
        setMemberStatus("");
        setMemberPage(1);
    }

    async function handleRemoveMember(userId: string) {
        setRemovingUserId(userId);
        setMembershipError(null);

        try {
            await removeUserFromGroup(userId, groupId);

            if (members.length === 1 && memberPage > 1) {
                setMemberPage((current) => current - 1);
            } else {
                setMemberRefreshKey((current) => current + 1);
            }
        } catch (error) {
            setMembershipError(
                error instanceof Error
                    ? error.message
                    : "Gagal menghapus member dari group"
            );
        } finally {
            setRemovingUserId(null);
        }
    }

    return (
        <section>
            <button type="button" onClick={onBack}>
                ← Back to Groups
            </button>

            <h3>Group Detail</h3>

            {loadingGroup && <p>Memuat detail group...</p>}

            {groupError && (
                <p>Gagal memuat detail group: {groupError}</p>
            )}

            {!loadingGroup && !groupError && group && (
                <>
                    <section>
                        <h4>Group Information</h4>

                        <form onSubmit={handleUpdateGroup}>
                            <div>
                                <label htmlFor="detail-group-name">
                                    Name
                                </label>
                                <input
                                    id="detail-group-name"
                                    type="text"
                                    value={editInput.name ?? ""}
                                    onChange={(event) =>
                                        setEditInput({
                                            ...editInput,
                                            name: event.target.value
                                        })
                                    }
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="detail-group-description">
                                    Description
                                </label>
                                <input
                                    id="detail-group-description"
                                    type="text"
                                    value={editInput.description ?? ""}
                                    onChange={(event) =>
                                        setEditInput({
                                            ...editInput,
                                            description: event.target.value
                                        })
                                    }
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={updatingGroup}
                            >
                                {updatingGroup
                                    ? "Saving..."
                                    : "Save Group"}
                            </button>
                        </form>

                        {updateError && (
                            <p>Gagal memperbarui group: {updateError}</p>
                        )}
                    </section>

                    <section>
                        <h4>Members</h4>

                        <form onSubmit={handleMemberSearch}>
                            <label htmlFor="group-member-search">
                                Search
                            </label>{" "}

                            <input
                                id="group-member-search"
                                type="search"
                                placeholder="Name or email"
                                value={memberSearchInput}
                                onChange={(event) =>
                                    setMemberSearchInput(event.target.value)
                                }
                            />{" "}

                            <label htmlFor="group-member-status">
                                Status
                            </label>{" "}

                            <select
                                id="group-member-status"
                                value={memberStatus}
                                onChange={(event) => {
                                    setMemberStatus(
                                        event.target.value as UserStatus | ""
                                    );
                                    setMemberPage(1);
                                }}
                            >
                                <option value="">All</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>{" "}

                            <button
                                type="submit"
                                disabled={membersLoading}
                            >
                                Search
                            </button>{" "}

                            <button
                                type="button"
                                onClick={handleClearMemberFilters}
                                disabled={membersLoading}
                            >
                                Clear
                            </button>
                        </form>

                        {membersLoading && <p>Memuat member...</p>}

                        {membersError && (
                            <p>Gagal memuat member: {membersError}</p>
                        )}

                        {!membersLoading &&
                            !membersError &&
                            members.length === 0 && (
                                <p>
                                    Tidak ada member yang cocok.
                                </p>
                            )}

                        {!membersLoading &&
                            !membersError &&
                            members.length > 0 && (
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
                                            {members.map((member) => (
                                                <tr key={member.id}>
                                                    <td>{member.name}</td>
                                                    <td>{member.email}</td>
                                                    <td>{member.status}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                removingUserId ===
                                                                member.id
                                                            }
                                                            onClick={() =>
                                                                void handleRemoveMember(
                                                                    member.id
                                                                )
                                                            }
                                                        >
                                                            {removingUserId ===
                                                            member.id
                                                                ? "Removing..."
                                                                : "Remove"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <Pagination
                                        pagination={memberPagination}
                                        disabled={membersLoading}
                                        onPageChange={setMemberPage}
                                    />
                                </>
                            )}

                        {membershipError && (
                            <p>
                                Gagal mengubah membership:{" "}
                                {membershipError}
                            </p>
                        )}

                        <p>
                            Untuk menambahkan user ke group ini, buka
                            User Detail lalu tambahkan membership dari sana.
                        </p>
                    </section>
                </>
            )}
        </section>
    );
}