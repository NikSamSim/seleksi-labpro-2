import { type FormEvent, useEffect, useState } from "react";

import {
    createApplication,
    listApplicationsPage
} from "../api/applications";

import type {
    Application,
    ApplicationStatus,
    CreateApplicationInput,
    PaginationMeta
} from "../api/types";

import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 20;

const initialCreateInput: CreateApplicationInput = {
    name: "",
    clientId: "",
    launchUrl: "",
    logoutNotificationUrl: ""
};

const initialPagination: PaginationMeta = {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0
};

type ApplicationsPageProps = {
    onOpenApplication: (applicationId: string) => void;
};

export function ApplicationsPage({
    onOpenApplication
}: ApplicationsPageProps) {
    const [applications, setApplications] = useState<Application[]>([]);
    const [pagination, setPagination] =
        useState<PaginationMeta>(initialPagination);

    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<ApplicationStatus | "">("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [createInput, setCreateInput] =
        useState<CreateApplicationInput>(initialCreateInput);

    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [createdClientSecret, setCreatedClientSecret] = useState<{
        applicationName: string;
        clientId: string;
        clientSecret: string;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadApplications() {
            setLoading(true);
            setError(null);

            try {
                const result = await listApplicationsPage({
                    page,
                    pageSize: PAGE_SIZE,
                    search: search || undefined,
                    status: status || undefined
                });

                if (cancelled) {
                    return;
                }

                setApplications(result.items);
                setPagination(result.pagination);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil daftar application"
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadApplications();

        return () => {
            cancelled = true;
        };
    }, [page, refreshKey, search, status]);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    }

    function handleClearFilters() {
        setSearchInput("");
        setSearch("");
        setStatus("");
        setPage(1);
    }

    async function handleCreateApplication(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setCreating(true);
        setCreateError(null);
        setCreatedClientSecret(null);

        try {
            const result = await createApplication({
                name: createInput.name,
                clientId: createInput.clientId,
                launchUrl: createInput.launchUrl?.trim()
                    ? createInput.launchUrl
                    : null,
                logoutNotificationUrl: createInput.logoutNotificationUrl
            });

            setCreatedClientSecret({
                applicationName: result.application.name,
                clientId: result.application.clientId,
                clientSecret: result.clientSecret
            });

            setCreateInput(initialCreateInput);
            setPage(1);
            setRefreshKey((current) => current + 1);
        } catch (error) {
            setCreateError(
                error instanceof Error
                    ? error.message
                    : "Gagal membuat application"
            );
        } finally {
            setCreating(false);
        }
    }

    return (
        <section>
            <h3>Applications</h3>

            <h4>Create Application</h4>

            <form onSubmit={handleCreateApplication}>
                <div>
                    <label htmlFor="create-application-name">
                        Name
                    </label>
                    <input
                        id="create-application-name"
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
                    <label htmlFor="create-application-client-id">
                        Client ID
                    </label>
                    <input
                        id="create-application-client-id"
                        type="text"
                        value={createInput.clientId}
                        onChange={(event) =>
                            setCreateInput({
                                ...createInput,
                                clientId: event.target.value
                            })
                        }
                        required
                    />
                </div>

                <div>
                    <label htmlFor="create-application-launch-url">
                        Launch URL
                    </label>
                    <input
                        id="create-application-launch-url"
                        type="url"
                        value={createInput.launchUrl ?? ""}
                        onChange={(event) =>
                            setCreateInput({
                                ...createInput,
                                launchUrl: event.target.value
                            })
                        }
                        placeholder="http://localhost:4000"
                    />
                </div>

                <div>
                    <label htmlFor="create-application-logout-url">
                        Logout Notification URL
                    </label>
                    <input
                        id="create-application-logout-url"
                        type="url"
                        value={createInput.logoutNotificationUrl}
                        onChange={(event) =>
                            setCreateInput({
                                ...createInput,
                                logoutNotificationUrl: event.target.value
                            })
                        }
                        placeholder="http://app-a:4000/internal/logout"
                        required
                    />
                </div>

                <button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create Application"}
                </button>

                {createError && (
                    <p>
                        Gagal membuat application: {createError}
                    </p>
                )}
            </form>

            {createdClientSecret && (
                <section>
                    <h4>Client Secret</h4>

                    <p>
                        Application{" "}
                        <strong>
                            {createdClientSecret.applicationName}
                        </strong>{" "}
                        berhasil dibuat.
                    </p>

                    <p>
                        Client ID:{" "}
                        <code>
                            {createdClientSecret.clientId}
                        </code>
                    </p>

                    <p>
                        Client Secret:{" "}
                        <code>
                            {createdClientSecret.clientSecret}
                        </code>
                    </p>

                    <p>
                        Simpan client secret sekarang. Nilai ini tidak
                        akan ditampilkan lagi.
                    </p>

                    <button
                        type="button"
                        onClick={() => setCreatedClientSecret(null)}
                    >
                        Dismiss
                    </button>
                </section>
            )}

            <h4>Application List</h4>

            <form onSubmit={handleSearch}>
                <label htmlFor="application-search">
                    Search
                </label>{" "}

                <input
                    id="application-search"
                    type="search"
                    placeholder="Name or client ID"
                    value={searchInput}
                    onChange={(event) =>
                        setSearchInput(event.target.value)
                    }
                />{" "}

                <label htmlFor="application-status-filter">
                    Status
                </label>{" "}

                <select
                    id="application-status-filter"
                    value={status}
                    onChange={(event) => {
                        setStatus(
                            event.target.value as ApplicationStatus | ""
                        );
                        setPage(1);
                    }}
                >
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>{" "}

                <button type="submit" disabled={loading}>
                    Search
                </button>{" "}

                <button
                    type="button"
                    onClick={handleClearFilters}
                    disabled={loading}
                >
                    Clear
                </button>
            </form>

            {loading && <p>Memuat application...</p>}

            {error && (
                <p>
                    Gagal memuat application: {error}
                </p>
            )}

            {!loading && !error && applications.length === 0 && (
                <p>Tidak ada application yang cocok.</p>
            )}

            {!loading && !error && applications.length > 0 && (
                <>
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Client ID</th>
                                <th>Status</th>
                                <th>Launch URL</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {applications.map((application) => (
                                <tr key={application.id}>
                                    <td>{application.name}</td>
                                    <td>{application.clientId}</td>
                                    <td>{application.status}</td>
                                    <td>
                                        {application.launchUrl ?? "-"}
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onOpenApplication(
                                                    application.id
                                                )
                                            }
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