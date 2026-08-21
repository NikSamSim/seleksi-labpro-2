import {
    type FormEvent,
    useEffect,
    useState
} from "react";

import {
    createUser,
    listUsersPage
} from "../api/users";
import type {
    CreateUserInput,
    PaginationMeta,
    User,
    UserStatus
} from "../api/types";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 20;

const initialCreateInput: CreateUserInput = {
    name: "",
    email: "",
    password: ""
};

const initialPagination: PaginationMeta = {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0
};

type UsersPageProps = {
    onOpenUser: (userId: string) => void;
};

export function UsersPage({
    onOpenUser
}: UsersPageProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [pagination, setPagination] =
        useState<PaginationMeta>(initialPagination);

    const [page, setPage] = useState(1);

    const [searchInput, setSearchInput] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [status, setStatus] =
        useState<UserStatus | "">("");

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [refreshKey, setRefreshKey] =
        useState(0);

    const [createInput, setCreateInput] =
        useState<CreateUserInput>(
            initialCreateInput
        );

    const [creating, setCreating] =
        useState(false);

    const [createError, setCreateError] =
        useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadUsers() {
            setLoading(true);
            setError(null);

            try {
                const result =
                    await listUsersPage({
                        page,
                        pageSize: PAGE_SIZE,
                        search:
                            search ||
                            undefined,
                        status:
                            status ||
                            undefined
                    });

                if (cancelled) {
                    return;
                }

                setUsers(result.items);
                setPagination(
                    result.pagination
                );
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil daftar user"
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadUsers();

        return () => {
            cancelled = true;
        };
    }, [
        page,
        refreshKey,
        search,
        status
    ]);

    function handleSearch(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setPage(1);
        setSearch(
            searchInput.trim()
        );
    }

    function handleClearFilters() {
        setSearchInput("");
        setSearch("");
        setStatus("");
        setPage(1);
    }

    async function handleCreateUser(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setCreating(true);
        setCreateError(null);

        try {
            await createUser(
                createInput
            );

            setCreateInput(
                initialCreateInput
            );

            setPage(1);

            setRefreshKey(
                (current) =>
                    current + 1
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

    return (
        <section>
            <h3>Users</h3>

            <h4>Create User</h4>

            <form
                onSubmit={
                    handleCreateUser
                }
            >
                <div>
                    <label
                        htmlFor="create-user-name"
                    >
                        Name
                    </label>

                    <input
                        id="create-user-name"
                        type="text"
                        value={
                            createInput.name
                        }
                        onChange={(
                            event
                        ) =>
                            setCreateInput({
                                ...createInput,
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
                        htmlFor="create-user-email"
                    >
                        Email
                    </label>

                    <input
                        id="create-user-email"
                        type="email"
                        value={
                            createInput.email
                        }
                        onChange={(
                            event
                        ) =>
                            setCreateInput({
                                ...createInput,
                                email:
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
                        htmlFor="create-user-password"
                    >
                        Password
                    </label>

                    <input
                        id="create-user-password"
                        type="password"
                        value={
                            createInput.password
                        }
                        onChange={(
                            event
                        ) =>
                            setCreateInput({
                                ...createInput,
                                password:
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
                    disabled={creating}
                >
                    {creating
                        ? "Creating..."
                        : "Create User"}
                </button>

                {createError && (
                    <p>
                        Gagal membuat
                        user:{" "}
                        {createError}
                    </p>
                )}
            </form>

            <h4>User List</h4>

            <form
                onSubmit={
                    handleSearch
                }
            >
                <label
                    htmlFor="user-search"
                >
                    Search
                </label>{" "}

                <input
                    id="user-search"
                    type="search"
                    placeholder="Name or email"
                    value={searchInput}
                    onChange={(
                        event
                    ) =>
                        setSearchInput(
                            event
                                .target
                                .value
                        )
                    }
                />{" "}

                <label
                    htmlFor="user-status-filter"
                >
                    Status
                </label>{" "}

                <select
                    id="user-status-filter"
                    value={status}
                    onChange={(
                        event
                    ) => {
                        setStatus(
                            event
                                .target
                                .value as
                                UserStatus |
                                ""
                        );

                        setPage(1);
                    }}
                >
                    <option value="">
                        All
                    </option>

                    <option value="active">
                        Active
                    </option>

                    <option value="inactive">
                        Inactive
                    </option>
                </select>{" "}

                <button
                    type="submit"
                    disabled={loading}
                >
                    Search
                </button>{" "}

                <button
                    type="button"
                    onClick={
                        handleClearFilters
                    }
                    disabled={loading}
                >
                    Clear
                </button>
            </form>

            {loading && (
                <p>
                    Memuat user...
                </p>
            )}

            {error && (
                <p>
                    Gagal memuat user:{" "}
                    {error}
                </p>
            )}

            {!loading &&
                !error &&
                users.length === 0 && (
                    <p>
                        Tidak ada user
                        yang cocok.
                    </p>
                )}

            {!loading &&
                !error &&
                users.length > 0 && (
                    <>
                        <table>
                            <thead>
                                <tr>
                                    <th>
                                        Name
                                    </th>
                                    <th>
                                        Email
                                    </th>
                                    <th>
                                        Status
                                    </th>
                                    <th>
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {users.map(
                                    (
                                        user
                                    ) => (
                                        <tr
                                            key={
                                                user.id
                                            }
                                        >
                                            <td>
                                                {
                                                    user.name
                                                }
                                            </td>

                                            <td>
                                                {
                                                    user.email
                                                }
                                            </td>

                                            <td>
                                                {
                                                    user.status
                                                }
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onOpenUser(
                                                            user.id
                                                        )
                                                    }
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>

                        <Pagination
                            pagination={
                                pagination
                            }
                            disabled={
                                loading
                            }
                            onPageChange={
                                setPage
                            }
                        />
                    </>
                )}
        </section>
    );
}