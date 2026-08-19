import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest
} from "fastify";
import QRCode from "qrcode";

import { env } from "../../config/env.js";
import { AppError } from "../../http/errors.js";
import { validateCentralSession } from "../sessions/service.js";
import {
    confirmTotpEnrollmentBodySchema,
    loginMfaBodySchema
} from "./schemas.js";
import {
    confirmTotpEnrollment,
    getMfaChallenge,
    getUserMfaStatus,
    startTotpEnrollment,
    verifyMfaRecovery,
    verifyMfaTotp
} from "./service.js";

async function requireMfaSession(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const rawToken = request.cookies[env.SSO_COOKIE_NAME];

    if (!rawToken) {
        await redirectToLogin(reply);
        return null;
    }

    const result = await validateCentralSession(rawToken);

    if (!result) {
        reply.clearCookie(env.SSO_COOKIE_NAME, { path: "/" });
        await redirectToLogin(reply);
        return null;
    }

    return result;
}

async function redirectToLogin(reply: FastifyReply) {
    return reply
        .code(303)
        .header("location", "/login?returnTo=%2Fsecurity%2Fmfa")
        .send();
}

function renderPage(content: string) {
    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MFA - Labpro Auth Provider</title>
</head>
<body>
    <main>
        <h1>Labpro Auth Provider</h1>
        ${content}
    </main>
</body>
</html>
    `;
}

function renderLoginMfaPage(errorMessage?: string) {
    return renderPage(`
        <h2>Multi-Factor Authentication</h2>

        ${errorMessage ? `<p>${errorMessage}</p>` : ""}

        <p>Enter the 6-digit code from your authenticator app.</p>

        <form method="post" action="/login/mfa">
            <input type="hidden" name="method" value="totp" />

            <div>
                <label for="totp-code">Authentication code</label>
                <input
                    id="totp-code"
                    name="code"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    pattern="[0-9]{6}"
                    minlength="6"
                    maxlength="6"
                    required
                    autofocus
                />
            </div>

            <button type="submit">Verify</button>
        </form>

        <hr />

        <h3>Lost access to your authenticator?</h3>
        <p>Use one of your recovery codes.</p>

        <form method="post" action="/login/mfa">
            <input type="hidden" name="method" value="recovery" />

            <div>
                <label for="recovery-code">Recovery code</label>
                <input
                    id="recovery-code"
                    name="code"
                    type="text"
                    autocomplete="off"
                    maxlength="16"
                    required
                />
            </div>

            <button type="submit">Use recovery code</button>
        </form>
    `);
}

export async function mfaRoutes(app: FastifyInstance) {
    app.get("/login/mfa", async (request, reply) => {
        const rawToken =
            request.cookies[env.MFA_PENDING_COOKIE_NAME];

        if (!rawToken) {
            return reply
                .code(303)
                .header("location", "/login")
                .send();
        }

        const pending = await getMfaChallenge(rawToken);

        if (!pending) {
            reply.clearCookie(
                env.MFA_PENDING_COOKIE_NAME,
                { path: "/" }
            );

            return reply
                .code(303)
                .header("location", "/login")
                .send();
        }

        reply.header("Cache-Control", "no-store");

        return reply
            .type("text/html; charset=utf-8")
            .send(renderLoginMfaPage());
    });

    app.post("/login/mfa", async (request, reply) => {
        const rawToken =
            request.cookies[env.MFA_PENDING_COOKIE_NAME];

        if (!rawToken) {
            return reply
                .code(303)
                .header("location", "/login")
                .send();
        }

        const input = loginMfaBodySchema.parse(request.body);

        const verificationInput = {
            rawToken,
            code: input.code,
            ipAddress: request.ip,
            userAgent:
                request.headers["user-agent"] ?? null
        };

        const result =
            input.method === "totp"
                ? await verifyMfaTotp(verificationInput)
                : await verifyMfaRecovery(verificationInput);

        reply.header("Cache-Control", "no-store");

        if (result.status === "invalid_challenge") {
            reply.clearCookie(
                env.MFA_PENDING_COOKIE_NAME,
                { path: "/" }
            );

            return reply
                .code(400)
                .type("text/html; charset=utf-8")
                .send(
                    renderPage(`
                        <h2>MFA Verification Failed</h2>
                        <p>Kode MFA tidak valid atau challenge telah kedaluwarsa.</p>
                        <p><a href="/login">Login again</a></p>
                    `)
                );
        }

        if (result.status === "invalid_factor") {
            if (result.locked) {
                reply.clearCookie(
                    env.MFA_PENDING_COOKIE_NAME,
                    { path: "/" }
                );

                return reply
                    .code(400)
                    .type("text/html; charset=utf-8")
                    .send(
                        renderPage(`
                            <h2>MFA Verification Failed</h2>
                            <p>Kode MFA tidak valid atau challenge telah kedaluwarsa.</p>
                            <p><a href="/login">Login again</a></p>
                        `)
                    );
            }

            return reply
                .code(400)
                .type("text/html; charset=utf-8")
                .send(
                    renderLoginMfaPage(
                        "Kode MFA tidak valid atau challenge telah kedaluwarsa."
                    )
                );
        }

        reply.setCookie(
            env.SSO_COOKIE_NAME,
            result.rawToken,
            {
                httpOnly: true,
                sameSite: "lax",
                secure: env.NODE_ENV === "production",
                path: "/",
                maxAge: env.SSO_SESSION_TTL_SECONDS
            }
        );

        reply.clearCookie(
            env.MFA_PENDING_COOKIE_NAME,
            { path: "/" }
        );

        if (result.returnTo) {
            return reply
                .code(303)
                .header("location", result.returnTo)
                .send();
        }

        return {
            user: result.user,
            session: result.session
        };
    });

    app.get("/security/mfa", async (request, reply) => {
        const principal = await requireMfaSession(
            request,
            reply
        );

        if (!principal) {
            return;
        }

        const status = await getUserMfaStatus(
            principal.user.id
        );

        reply.header("Cache-Control", "no-store");

        if (status.enabled) {
            return reply
                .type("text/html; charset=utf-8")
                .send(
                    renderPage(`
                        <h2>Multi-Factor Authentication</h2>
                        <p>MFA Status: <strong>Enabled</strong></p>
                        <p>TOTP MFA is active for this account.</p>
                    `)
                );
        }

        return reply
            .type("text/html; charset=utf-8")
            .send(
                renderPage(`
                    <h2>Multi-Factor Authentication</h2>
                    <p>MFA Status: <strong>Disabled</strong></p>

                    <form method="post" action="/security/mfa/start">
                        <button type="submit">Enable TOTP MFA</button>
                    </form>
                `)
            );
    });

    app.post("/security/mfa/start", async (request, reply) => {
        const principal = await requireMfaSession(
            request,
            reply
        );

        if (!principal) {
            return;
        }

        const enrollment = await startTotpEnrollment({
            userId: principal.user.id,
            accountLabel: principal.user.email
        });

        const qrDataUrl = await QRCode.toDataURL(
            enrollment.otpauthUri
        );

        reply.header("Cache-Control", "no-store");

        return reply
            .type("text/html; charset=utf-8")
            .send(
                renderPage(`
                    <h2>Set Up TOTP MFA</h2>

                    <p>
                        Scan this QR code with Google Authenticator,
                        Authy, or another compatible authenticator application.
                    </p>

                    <div>
                        <img
                            src="${qrDataUrl}"
                            alt="TOTP enrollment QR code"
                        />
                    </div>

                    <p>Manual setup key:</p>
                    <p><code>${enrollment.secret}</code></p>

                    <form method="post" action="/security/mfa/confirm">
                        <div>
                            <label for="code">Verification code</label>
                            <input
                                id="code"
                                name="code"
                                type="text"
                                inputmode="numeric"
                                autocomplete="one-time-code"
                                pattern="[0-9]{6}"
                                minlength="6"
                                maxlength="6"
                                required
                            />
                        </div>

                        <button type="submit">Confirm MFA</button>
                    </form>
                `)
            );
    });

    app.post("/security/mfa/confirm", async (request, reply) => {
        const principal = await requireMfaSession(
            request,
            reply
        );

        if (!principal) {
            return;
        }

        const input =
            confirmTotpEnrollmentBodySchema.parse(
                request.body
            );

        try {
            const result = await confirmTotpEnrollment({
                userId: principal.user.id,
                code: input.code,
                sessionId: principal.session.id,
                ipAddress: request.ip
            });

            reply.header("Cache-Control", "no-store");

            const recoveryCodeItems = result.recoveryCodes
                .map(
                    (code) =>
                        `<li><code>${code}</code></li>`
                )
                .join("");

            return reply
                .type("text/html; charset=utf-8")
                .send(
                    renderPage(`
                        <h2>MFA Enabled Successfully</h2>

                        <p>Save these recovery codes now.</p>

                        <p>
                            Each recovery code can only be used once.
                            They will not be shown again.
                        </p>

                        <ul>${recoveryCodeItems}</ul>

                        <p>
                            <a href="/security/mfa">Continue</a>
                        </p>
                    `)
                );
        } catch (error) {
            if (
                error instanceof AppError &&
                error.code === "INVALID_REQUEST"
            ) {
                reply.header(
                    "Cache-Control",
                    "no-store"
                );

                return reply
                    .code(400)
                    .type("text/html; charset=utf-8")
                    .send(
                        renderPage(`
                            <h2>MFA Verification Failed</h2>

                            <p>Kode MFA tidak valid.</p>

                            <p>
                                Anda dapat mencoba kode authenticator lagi.
                            </p>

                            <form
                                method="post"
                                action="/security/mfa/confirm"
                            >
                                <div>
                                    <label for="code">
                                        Verification code
                                    </label>

                                    <input
                                        id="code"
                                        name="code"
                                        type="text"
                                        inputmode="numeric"
                                        autocomplete="one-time-code"
                                        pattern="[0-9]{6}"
                                        minlength="6"
                                        maxlength="6"
                                        required
                                    />
                                </div>

                                <button type="submit">
                                    Try Again
                                </button>
                            </form>

                            <p>
                                <a href="/security/mfa">
                                    Restart enrollment
                                </a>
                            </p>
                        `)
                    );
            }

            throw error;
        }
    });
}