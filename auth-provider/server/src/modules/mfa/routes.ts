import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest
} from "fastify";
import QRCode from "qrcode";

import { env } from "../../config/env.js";
import { AppError } from "../../http/errors.js";
import {
    hasRecentMfaVerification,
    validateCentralSession
} from "../sessions/service.js";
import {
    confirmTotpEnrollmentBodySchema,
    loginMfaBodySchema,
    startTotpReplacementBodySchema
} from "./schemas.js";
import {
    confirmTotpEnrollment,
    confirmTotpReplacement,
    getMfaChallenge,
    getUserMfaStatus,
    startTotpEnrollment,
    startTotpReplacement,
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

function renderMfaReplacementPage(
    errorMessage?: string,
    needsReauthentication = false
) {
    return renderPage(`
        <h2>Replace Authenticator</h2>

        <p>
            Authenticator lama akan tetap aktif sampai
            authenticator baru berhasil dikonfirmasi.
        </p>

        ${
            errorMessage
                ? `<p>${errorMessage}</p>`
                : ""
        }

        ${
            needsReauthentication
                ? `
                    <p>
                        Verifikasi MFA pada session ini
                        sudah terlalu lama.
                    </p>

                    <p>
                        <a
                            href="/login?returnTo=%2Fsecurity%2Fmfa%2Freplace"
                        >
                            Re-authenticate
                        </a>
                    </p>
                `
                : `
                    <form
                        method="post"
                        action="/security/mfa/replace/start"
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

                        <button type="submit">
                            Continue
                        </button>
                    </form>
                `
        }

        <p>
            <a href="/security/mfa">
                Back to MFA settings
            </a>
        </p>
    `);
}

function renderMfaReplacementSetupPage(
    qrDataUrl: string,
    secret: string,
    expiresAt: Date
) {
    return renderPage(`
        <h2>Set Up New Authenticator</h2>

        <p>
            <strong>
                Authenticator lama masih aktif.
            </strong>
        </p>

        <p>
            Authenticator baru belum akan digunakan
            sampai verification code berhasil
            dikonfirmasi.
        </p>

        <p>
            Scan QR berikut menggunakan perangkat
            atau authenticator baru.
        </p>

        <div>
            <img
                src="${qrDataUrl}"
                alt="New TOTP authenticator QR code"
            />
        </div>

        <p>Manual setup key:</p>
        <p>
            <code>${secret}</code>
        </p>

        <p>
            Pending setup expires at:
            <code>${expiresAt.toISOString()}</code>
        </p>

        <form
            method="post"
            action="/security/mfa/replace/confirm"
        >
            <div>
                <label for="code">
                    Verification code from new authenticator
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
                    autofocus
                />
            </div>

            <button type="submit">
                Confirm New Authenticator
            </button>
        </form>

        <p>
            <a href="/security/mfa">
                Cancel replacement
            </a>
        </p>
    `);
}

function renderMfaReplacementConfirmError(
    message: string,
    locked = false
) {
    return renderPage(`
        <h2>Authenticator Replacement Failed</h2>

        <p>${message}</p>

        ${
            locked
                ? `
                    <p>
                        Batas percobaan telah tercapai.
                        Mulai replacement dari awal.
                    </p>

                    <p>
                        <a href="/security/mfa/replace">
                            Restart replacement
                        </a>
                    </p>
                `
                : `
                    <p>
                        Pastikan kode berasal dari
                        authenticator baru.
                    </p>

                    <form
                        method="post"
                        action="/security/mfa/replace/confirm"
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
                                autofocus
                            />
                        </div>

                        <button type="submit">
                            Try Again
                        </button>
                    </form>

                    <p>
                        <a href="/security/mfa/replace">
                            Restart replacement
                        </a>
                    </p>
                `
        }
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

        const recoveryCodeNotice =
            principal.session.mfaMethod ===
            "recovery_code"
                ? `
                    <p>
                        <strong>
                            This session was verified using a
                            recovery code.
                        </strong>
                    </p>

                    <p>
                        If your authenticator is lost or no longer
                        accessible, replace it before signing out.
                    </p>
                `
                : "";

        if (status.enabled) {
            return reply
                .type("text/html; charset=utf-8")
                .send(
                    renderPage(`
                        <h2>Multi-Factor Authentication</h2>

                        <p>
                            MFA Status:
                            <strong>Enabled</strong>
                        </p>

                        <p>
                            TOTP MFA is active for this account.
                        </p>

                        ${recoveryCodeNotice}

                        <p>
                            <a href="/security/mfa/replace">
                                Replace Authenticator
                            </a>
                        </p>

                        <p>
                            <a href="/account">
                                Back to account
                            </a>
                        </p>
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

    app.post(
        "/security/mfa/replace/confirm",
        async (request, reply) => {
            const principal =
                await requireMfaSession(
                    request,
                    reply
                );

            if (!principal) {
                return;
            }

            const input =
                confirmTotpEnrollmentBodySchema
                    .parse(request.body);

            const result =
                await confirmTotpReplacement({
                    userId:
                        principal.user.id,
                    sessionId:
                        principal.session.id,
                    code:
                        input.code,
                    ipAddress:
                        request.ip
                });

            reply.header(
                "Cache-Control",
                "no-store"
            );

            if (
                result.status ===
                "invalid_enrollment"
            ) {
                return reply
                    .code(400)
                    .type(
                        "text/html; charset=utf-8"
                    )
                    .send(
                        renderMfaReplacementConfirmError(
                            "Replacement MFA tidak tersedia atau telah kedaluwarsa.",
                            true
                        )
                    );
            }

            if (
                result.status ===
                "invalid_code"
            ) {
                return reply
                    .code(400)
                    .type(
                        "text/html; charset=utf-8"
                    )
                    .send(
                        renderMfaReplacementConfirmError(
                            "Kode authenticator baru tidak valid.",
                            result.locked
                        )
                    );
            }

            reply.clearCookie(
                env.SSO_COOKIE_NAME,
                {
                    path: "/"
                }
            );

            const recoveryCodeItems =
                result.recoveryCodes
                    .map(
                        (code) =>
                            `<li><code>${code}</code></li>`
                    )
                    .join("");

            return reply
                .type(
                    "text/html; charset=utf-8"
                )
                .send(
                    renderPage(`
                        <h2>
                            Authenticator Replaced Successfully
                        </h2>

                        <p>
                            Authenticator baru sekarang aktif.
                        </p>

                        <p>
                            Semua session lama telah dicabut.
                            Silakan login kembali setelah
                            menyimpan recovery codes berikut.
                        </p>

                        <p>
                            <strong>
                                Save these recovery codes now.
                            </strong>
                        </p>

                        <p>
                            Recovery codes lama sudah tidak berlaku.
                            Setiap code baru hanya dapat digunakan sekali
                            dan tidak akan ditampilkan lagi.
                        </p>

                        <ul>
                            ${recoveryCodeItems}
                        </ul>

                        <p>
                            <a href="/login?returnTo=%2Faccount">
                                Login again
                            </a>
                        </p>
                    `)
                );
        }
    );

    app.get(
        "/security/mfa/replace",
        async (request, reply) => {
            const principal =
                await requireMfaSession(
                    request,
                    reply
                );

            if (!principal) {
                return;
            }

            const status =
                await getUserMfaStatus(
                    principal.user.id
                );

            if (!status.enabled) {
                return reply
                    .code(303)
                    .header(
                        "location",
                        "/security/mfa"
                    )
                    .send();
            }

            reply.header(
                "Cache-Control",
                "no-store"
            );

            if (
                !hasRecentMfaVerification(
                    {
                        mfaVerifiedAt:
                            principal.session
                                .mfaVerifiedAt,

                        mfaMethod:
                            principal.session
                                .mfaMethod
                    }
                )
            ) {
                return reply
                    .type(
                        "text/html; charset=utf-8"
                    )
                    .send(
                        renderMfaReplacementPage(
                            "Verifikasi MFA terbaru diperlukan.",
                            true
                        )
                    );
            }

            return reply
                .type(
                    "text/html; charset=utf-8"
                )
                .send(
                    renderMfaReplacementPage()
                );
        }
    );

    app.post(
        "/security/mfa/replace/start",
        async (request, reply) => {
            const principal =
                await requireMfaSession(
                    request,
                    reply
                );

            if (!principal) {
                return;
            }

            const parsed =
                startTotpReplacementBodySchema
                    .safeParse(
                        request.body
                    );

            reply.header(
                "Cache-Control",
                "no-store"
            );

            if (!parsed.success) {
                return reply
                    .code(400)
                    .type(
                        "text/html; charset=utf-8"
                    )
                    .send(
                        renderMfaReplacementPage(
                            "Password saat ini wajib diisi."
                        )
                    );
            }

            try {
                const replacement =
                    await startTotpReplacement({
                        userId:
                            principal.user.id,

                        sessionId:
                            principal.session.id,

                        accountLabel:
                            principal.user.email,

                        currentPassword:
                            parsed.data
                                .currentPassword,

                        session: {
                            mfaVerifiedAt:
                                principal.session
                                    .mfaVerifiedAt,

                            mfaMethod:
                                principal.session
                                    .mfaMethod
                        }
                    });

                const qrDataUrl =
                    await QRCode.toDataURL(
                        replacement.otpauthUri
                    );

                return reply
                    .type(
                        "text/html; charset=utf-8"
                    )
                    .send(
                        renderMfaReplacementSetupPage(
                            qrDataUrl,
                            replacement.secret,
                            replacement.expiresAt
                        )
                    );
            } catch (error) {
                if (
                    error instanceof AppError &&
                    error.code ===
                        "UNAUTHORIZED"
                ) {
                    return reply
                        .code(401)
                        .type(
                            "text/html; charset=utf-8"
                        )
                        .send(
                            renderMfaReplacementPage(
                                error.message
                            )
                        );
                }

                if (
                    error instanceof AppError &&
                    error.code === "FORBIDDEN"
                ) {
                    return reply
                        .code(403)
                        .type(
                            "text/html; charset=utf-8"
                        )
                        .send(
                            renderMfaReplacementPage(
                                error.message,
                                true
                            )
                        );
                }

                if (
                    error instanceof AppError &&
                    error.code === "CONFLICT"
                ) {
                    return reply
                        .code(303)
                        .header(
                            "location",
                            "/security/mfa"
                        )
                        .send();
                }

                throw error;
            }
        }
    );

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