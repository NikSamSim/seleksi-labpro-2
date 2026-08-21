import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest
} from "fastify";

import { env } from "../../config/env.js";
import { logoutSso } from "../auth/service.js";
import { validateCentralSession } from "../sessions/service.js";

import { AppError } from "../../http/errors.js";

import {
    changeOwnPasswordBodySchema
} from "./schemas.js";
import {
    changeOwnPassword
} from "./service.js";

function escapeHtml(value: string) {
    const replacements: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return value.replace(
        /[&<>"']/g,
        (character) =>
            replacements[character] ?? character
    );
}

function redirectToLogin(
    reply: FastifyReply,
    returnTo = "/account"
) {
    return reply
        .code(303)
        .header(
            "location",
            `/login?returnTo=${encodeURIComponent(
                returnTo
            )}`
        )
        .send();
}

function renderAccountPage(input: {
    name: string;
    email: string;
}) {
    const name = escapeHtml(input.name);
    const email = escapeHtml(input.email);

    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    />
    <title>Account - Labpro Auth Provider</title>
</head>
<body>
    <main>
        <h1>Labpro Auth Provider</h1>
        <h2>Account</h2>

        <section>
            <h3>Profile</h3>
            <p>
                Signed in as
                <strong>${name}</strong>
            </p>
            <p>${email}</p>
        </section>

        <hr />

        <section>
            <h3>Security</h3>

            <p>
                <a href="/account/password">
                    Change Password
                </a>
            </p>

            <p>
                <a href="/security/mfa">
                    Manage MFA
                </a>
            </p>
        </section>

        <hr />

        <section>
            <h3>Session</h3>

            <form
                method="post"
                action="/account/logout/sso"
            >
                <button type="submit">
                    SSO Logout
                </button>
            </form>
        </section>
    </main>
</body>
</html>
    `;
}

function renderChangePasswordPage(
    errorMessage?: string,
    needsReauthentication = false
) {
    const safeErrorMessage =
        errorMessage
            ? escapeHtml(
                errorMessage
            )
            : null;

    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    />
    <title>Change Password - Labpro Auth Provider</title>
</head>
<body>
    <main>
        <h1>Labpro Auth Provider</h1>
        <h2>Change Password</h2>

        ${
            safeErrorMessage
                ? `<p>${safeErrorMessage}</p>`
                : ""
        }

        ${
            needsReauthentication
                ? `
                    <p>
                        MFA verification pada session ini sudah terlalu lama.
                    </p>

                    <p>
                        <a href="/login?returnTo=%2Faccount%2Fpassword">
                            Re-authenticate
                        </a>
                    </p>
                `
                : `
                    <form
                        method="post"
                        action="/account/password"
                    >
                        <div>
                            <label for="currentPassword">
                                Current password
                            </label>
                            <input
                                id="currentPassword"
                                name="currentPassword"
                                type="password"
                                autocomplete="current-password"
                                required
                            />
                        </div>

                        <div>
                            <label for="newPassword">
                                New password
                            </label>
                            <input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                autocomplete="new-password"
                                required
                            />
                        </div>

                        <div>
                            <label for="confirmNewPassword">
                                Confirm new password
                            </label>
                            <input
                                id="confirmNewPassword"
                                name="confirmNewPassword"
                                type="password"
                                autocomplete="new-password"
                                required
                            />
                        </div>

                        <button type="submit">
                            Change Password
                        </button>
                    </form>
                `
        }

        <p>
            <a href="/account">
                Back to account
            </a>
        </p>
    </main>
</body>
</html>
    `;
}

export async function accountRoutes(
    app: FastifyInstance
) {
    app.get("/account", async (request, reply) => {
        const rawToken =
            request.cookies[env.SSO_COOKIE_NAME];

        if (!rawToken) {
            return redirectToLogin(reply);
        }

        const principal =
            await requireAccountSession(
                request,
                reply
            );

        if (!principal) {
            return;
        }

        reply.header("Cache-Control", "no-store");

        return reply
            .type("text/html; charset=utf-8")
            .send(
                renderAccountPage({
                    name: principal.user.name,
                    email: principal.user.email
                })
            );
    });

    app.post(
        "/account/logout/sso",
        async (request, reply) => {
            const rawToken =
                request.cookies[
                    env.SSO_COOKIE_NAME
                ];

            await logoutSso(rawToken, {
                ipAddress: request.ip
            });

            reply.clearCookie(
                env.SSO_COOKIE_NAME,
                {
                    path: "/"
                }
            );

            reply.header(
                "Cache-Control",
                "no-store"
            );

            return reply
                .code(303)
                .header("location", "/login")
                .send();
        }
    );

    app.get(
        "/account/password",
        async (request, reply) => {
            const principal =
                await requireAccountSession(
                    request,
                    reply,
                    "/account/password"
                );

            if (!principal) {
                return;
            }

            reply.header(
                "Cache-Control",
                "no-store"
            );

            return reply
                .type(
                    "text/html; charset=utf-8"
                )
                .send(
                    renderChangePasswordPage()
                );
        }
    );

    app.post(
        "/account/password",
        async (request, reply) => {
            const principal =
                await requireAccountSession(
                    request,
                    reply,
                    "/account/password"
                );

            if (!principal) {
                return;
            }

            const parsed =
                changeOwnPasswordBodySchema
                    .safeParse(
                        request.body
                    );

            if (!parsed.success) {
                reply.header(
                    "Cache-Control",
                    "no-store"
                );

                return reply
                    .code(400)
                    .type(
                        "text/html; charset=utf-8"
                    )
                    .send(
                        renderChangePasswordPage(
                            parsed.error.issues[0]
                                ?.message ??
                                "Input tidak valid"
                        )
                    );
            }

            try {
                await changeOwnPassword(
                    parsed.data,
                    {
                        userId:
                            principal.user.id,

                        session: {
                            mfaVerifiedAt:
                                principal
                                    .session
                                    .mfaVerifiedAt,

                            mfaMethod:
                                principal
                                    .session
                                    .mfaMethod
                        },

                        ipAddress:
                            request.ip
                    }
                );
            } catch (error) {
                if (
                    error instanceof AppError &&
                    (
                        error.code ===
                            "UNAUTHORIZED" ||
                        error.code ===
                            "FORBIDDEN"
                    )
                ) {
                    reply.header(
                        "Cache-Control",
                        "no-store"
                    );

                    return reply
                        .code(
                            error.statusCode
                        )
                        .type(
                            "text/html; charset=utf-8"
                        )
                        .send(
                            renderChangePasswordPage(
                                error.message,
                                error.code ===
                                    "FORBIDDEN"
                            )
                        );
                }

                throw error;
            }

            reply.clearCookie(
                env.SSO_COOKIE_NAME,
                {
                    path: "/"
                }
            );

            reply.header(
                "Cache-Control",
                "no-store"
            );

            return reply
                .code(303)
                .header(
                    "location",
                    "/login?returnTo=%2Faccount"
                )
                .send();
        }
    );
}

async function requireAccountSession(
    request: FastifyRequest,
    reply: FastifyReply,
    returnTo = "/account"
) {
    const rawToken =
        request.cookies[
            env.SSO_COOKIE_NAME
        ];

    if (!rawToken) {
        await redirectToLogin(
            reply,
            returnTo
        );

        return null;
    }

    const principal =
        await validateCentralSession(
            rawToken
        );

    if (!principal) {
        reply.clearCookie(
            env.SSO_COOKIE_NAME,
            {
                path: "/"
            }
        );

        await redirectToLogin(
            reply,
            returnTo
        );

        return null;
    }

    return principal;
}