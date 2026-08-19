import type { FastifyInstance } from "fastify";

import { env } from "../../config/env.js";

import {
    isSafeReturnTo,
    loginBodySchema,
    loginQuerySchema
} from "./schemas.js";
import { login, logoutSso } from "./service.js";
import { validateCentralSession } from "../sessions/service.js";


const controlPanelOrigin = new URL(env.CONTROL_PANEL_ORIGIN).origin;

function resolveSafeReturnTo(
    returnTo: string | undefined
) {
    if (isSafeReturnTo(returnTo)) {
        return returnTo;
    }

    if (returnTo === controlPanelOrigin) {
        return returnTo;
    }

    return undefined;
}

export async function authRoutes(app: FastifyInstance) {
    app.get("/login", async (request, reply) => {
        const query =
            loginQuerySchema.parse(request.query);

        const returnTo = resolveSafeReturnTo(query.returnTo);

        const action = returnTo
            ? `/login?returnTo=${encodeURIComponent(returnTo)}`
            : "/login";

        return reply
            .type("text/html; charset=utf-8")
            .send(`
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
        />
        <title>Login - Labpro Auth Provider</title>
    </head>
    <body>
        <main>
            <h1>Labpro Auth Provider</h1>
            <h2>Login</h2>

            <form method="post" action="${action}">
                <div>
                    <label for="email">Email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autocomplete="username"
                        required
                    />
                </div>

                <div>
                    <label for="password">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autocomplete="current-password"
                        required
                    />
                </div>

                <button type="submit">
                    Login
                </button>
            </form>
        </main>
    </body>
    </html>
            `);
    });

    app.get("/session", async (request, reply) => {
        const rawToken =
            request.cookies[env.SSO_COOKIE_NAME];

        if (!rawToken) {
            return {
                authenticated: false
            };
        }

        const result =
            await validateCentralSession(rawToken);

        if (!result) {
            reply.clearCookie(
                env.SSO_COOKIE_NAME,
                {
                    path: "/"
                }
            );

            return {
                authenticated: false
            };
        }

        return {
            authenticated: true,
            user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email
            },
            session: {
                id: result.session.id,
                status: result.session.status,
                expiresAt: result.session.expiresAt
            }
        };
    });

    app.post("/logout/sso", async (request, reply) => {
        const rawToken =
            request.cookies[env.SSO_COOKIE_NAME];

        await logoutSso(rawToken, {
            ipAddress: request.ip
        });

        reply.clearCookie(
            env.SSO_COOKIE_NAME,
            {
                path: "/"
            }
        );

        return {
            success: true
        };
    });

    app.post("/login", async (request, reply) => {
        const query =
            loginQuerySchema.parse(request.query);

        const returnTo = resolveSafeReturnTo(query.returnTo);

        const input =
            loginBodySchema.parse(request.body);

        const result = await login(
            input,
            {
                ipAddress: request.ip,
                userAgent:
                    request.headers["user-agent"] ??
                    null,
                returnTo,
                logger: request.log
            }
        );

        if (result.status === "mfa_required") {
            reply.setCookie(
                env.MFA_PENDING_COOKIE_NAME,
                result.rawChallengeToken,
                {
                    httpOnly: true,
                    sameSite: "lax",
                    secure:
                        env.NODE_ENV === "production",
                    path: "/",
                    maxAge:
                        env.MFA_CHALLENGE_TTL_SECONDS
                }
            );

            return reply
                .code(303)
                .header("location", "/login/mfa")
                .send();
        }

        reply.setCookie(
            env.SSO_COOKIE_NAME,
            result.rawToken,
            {
                httpOnly: true,
                sameSite: "lax",
                secure:
                    env.NODE_ENV === "production",
                path: "/",
                maxAge:
                    env.SSO_SESSION_TTL_SECONDS
            }
        );

        if (returnTo) {
            return reply
                .code(303)
                .header("location", returnTo)
                .send();
        }

        return {
            user: result.user,
            session: result.session
        };
    });
}