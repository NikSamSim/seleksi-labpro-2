import { type FormEvent, useEffect, useState } from "react";

import { createGroup, listGroupsPage } from "../api/groups";
import type { CreateGroupInput, Group, PaginationMeta } from "../api/types";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 20;

const initialCreateInput: CreateGroupInput = {
    name: "",
    description: ""
};

const initialPagination: PaginationMeta = {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0
};

type GroupsPageProps = {
    onOpenGroup: (groupId: string) => void;
};

export function GroupsPage({ onOpenGroup }: GroupsPageProps) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta>(initialPagination);

    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [createInput, setCreateInput] = useState<CreateGroupInput>(initialCreateInput);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadGroups() {
            setLoading(true);
            setError(null);

            try {
                const result = await listGroupsPage({
                    page,
                    pageSize: PAGE_SIZE,
                    search: search || undefined
                });

                if (cancelled) {
                    return;
                }

                setGroups(result.items);
                setPagination(result.pagination);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil daftar group"
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadGroups();

        return () => {
            cancelled = true;
        };
    }, [page, refreshKey, search]);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    }

    function handleClearSearch() {
        setSearchInput("");
        setSearch("");
        setPage(1);
    }

    async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setCreating(true);
        setCreateError(null);

        try {
            await createGroup({
                name: createInput.name,
                description: createInput.description?.trim() || null
            });

            setCreateInput(initialCreateInput);
            setPage(1);
            setRefreshKey((current) => current + 1);
        } catch (error) {
            setCreateError(
                error instanceof Error
                    ? error.message
                    : "Gagal membuat group"
            );
        } finally {
            setCreating(false);
        }
    }

    return (
        <section>
            <h3>Groups</h3>

            <h4>Create Group</h4>

            <form onSubmit={handleCreateGroup}>
                <div>
                    <label htmlFor="create-group-name">Name</label>
                    <input
                        id="create-group-name"
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
                    <label htmlFor="create-group-description">
                        Description
                    </label>
                    <input
                        id="create-group-description"
                        type="text"
                        value={createInput.description ?? ""}
                        onChange={(event) =>
                            setCreateInput({
                                ...createInput,
                                description: event.target.value
                            })
                        }
                    />
                </div>

                <button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create Group"}
                </button>

                {createError && (
                    <p>Gagal membuat group: {createError}</p>
                )}
            </form>

            <h4>Group List</h4>

            <form onSubmit={handleSearch}>
                <label htmlFor="group-search">Search</label>{" "}
                <input
                    id="group-search"
                    type="search"
                    placeholder="Name or description"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />{" "}

                <button type="submit" disabled={loading}>
                    Search
                </button>{" "}

                <button
                    type="button"
                    onClick={handleClearSearch}
                    disabled={loading}
                >
                    Clear
                </button>
            </form>

            {loading && <p>Memuat group...</p>}

            {error && <p>Gagal memuat group: {error}</p>}

            {!loading && !error && groups.length === 0 && (
                <p>Tidak ada group yang cocok.</p>
            )}

            {!loading && !error && groups.length > 0 && (
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
                                <tr key={group.id}>
                                    <td>{group.name}</td>
                                    <td>{group.description ?? "-"}</td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => onOpenGroup(group.id)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <Pagination
                        pagination={pagination}
                        disabled={loading}
                        onPageChange={setPage}
                    />
                </>
            )}
        </section>
    );
}