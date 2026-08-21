import { useEffect, useState } from "react";

import {
    getAdminLoginUrl,
    getAdminSession,
    logoutAdmin,
    type AdminSession
} from "./api/admin";
import {
    API_BASE_URL,
    ApiError
} from "./api/client";

import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { GroupDetailPage } from "./pages/GroupDetailPage";
import { GroupsPage } from "./pages/GroupsPage";
import { ObservabilityPage } from "./pages/ObservabilityPage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { UsersPage } from "./pages/UsersPage";

import "./App.css";

type AuthState =
    | "checking"
    | "signed-out"
    | "forbidden"
    | "authenticated"
    | "error";

type View =
    | {
        type: "users";
    }
    | {
        type: "user";
        userId: string;
    }
    | {
        type: "groups";
    }
    | {
        type: "group";
        groupId: string;
    }
    | {
        type: "applications";
    }
    | {
        type: "application";
        applicationId: string;
    }
    | {
        type: "observability";
    };

function App() {
    const [authState, setAuthState] =
        useState<AuthState>("checking");

    const [adminSession, setAdminSession] =
        useState<AdminSession | null>(null);

    const [authError, setAuthError] =
        useState<string | null>(null);

    const [view, setView] =
        useState<View>({
            type: "users"
        });

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
        setView({
            type: "users"
        });
        setAuthState("signed-out");
    }

    function renderActiveView() {
        switch (view.type) {
            case "users":
                return (
                    <UsersPage
                        onOpenUser={(userId) =>
                            setView({
                                type: "user",
                                userId
                            })
                        }
                    />
                );

            case "user":
                return (
                    <UserDetailPage
                        userId={view.userId}
                        onBack={() =>
                            setView({
                                type: "users"
                            })
                        }
                    />
                );

            case "groups":
                return (
                    <GroupsPage
                        onOpenGroup={(groupId) =>
                            setView({
                                type: "group",
                                groupId
                            })
                        }
                    />
                );

            case "group":
                return (
                    <GroupDetailPage
                        groupId={view.groupId}
                        onBack={() =>
                            setView({
                                type: "groups"
                            })
                        }
                    />
                );

            case "applications":
                return (
                    <ApplicationsPage
                        onOpenApplication={(applicationId) =>
                            setView({
                                type: "application",
                                applicationId
                            })
                        }
                    />
                );

            case "application":
                return (
                    <ApplicationDetailPage
                        applicationId={view.applicationId}
                        onBack={() =>
                            setView({
                                type: "applications"
                            })
                        }
                    />
                );

            case "observability":
                return (
                    <ObservabilityPage />
                );
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
                <p>Mengarahkan ke Central Login...</p>
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
                    User yang sedang login bukan anggota group
                    administrators.
                </p>

                <button
                    type="button"
                    onClick={() =>
                        void handleAdminLogout()
                    }
                >
                    SSO Logout
                </button>

                {authError && (
                    <p>
                        Logout gagal: {authError}
                    </p>
                )}
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

    return (
        <main className="control-panel">
            <header className="control-panel-header">
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

                        <a
                            href={`${API_BASE_URL}/security/mfa`}
                        >
                            Manage MFA
                        </a>{" "}

                        <button
                            type="button"
                            onClick={() =>
                                void handleAdminLogout()
                            }
                        >
                            SSO Logout
                        </button>
                    </div>
                )}

                {authError && (
                    <p>
                        {authError}
                    </p>
                )}

                <nav
                    className="control-panel-nav"
                    aria-label="Control Panel"
                >
                    <button
                        type="button"
                        onClick={() =>
                            setView({
                                type: "users"
                            })
                        }
                    >
                        Users
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setView({
                                type: "groups"
                            })
                        }
                    >
                        Groups
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setView({
                                type: "applications"
                            })
                        }
                    >
                        Applications
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setView({
                                type: "observability"
                            })
                        }
                    >
                        Observability
                    </button>
                </nav>
            </header>

            <div className="control-panel-content">
                {renderActiveView()}
            </div>
        </main>
    );
}

export default App;