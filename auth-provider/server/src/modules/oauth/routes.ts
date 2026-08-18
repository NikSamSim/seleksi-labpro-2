import type {
    FastifyInstance,
    FastifyReply
} from "fastify";

import { env } from "../../config/env.js";
import { AppError } from "../../http/errors.js";

import {
    evaluatePrevalidatedPolicy
} from "../policies/evaluator.js";

import {
    authorizeQuerySchema,
    tokenRequestSchema,
    userinfoHeadersSchema
} from "./schemas.js";

import {
    exchangeAuthorizationCode,
    issueAuthorizationCode,
    parseBearerToken,
    validateAuthorizationClient,
    validateAuthorizationRequest,
    validateTokenClient,
    validateTokenGrantType,
    validateUserinfoAccess
} from "./service.js";

import {
    writeAuditBestEffort
} from "../audit/service.js";

function buildRedirectUrl(
    redirectUri: string,
    params: Record<string, string>
) {
    const url = new URL(redirectUri);

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    return url.toString();
}

function redirect(
    reply: FastifyReply,
    location: string
) {
    return reply
        .code(302)
        .header("location", location)
        .send();
}

function buildLoginRedirect(
    requestUrl: string | undefined
) {
    const returnTo =
        requestUrl?.startsWith("/authorize")
            ? requestUrl
            : "/authorize";

    return `/login?returnTo=${encodeURIComponent(
        returnTo
    )}`;
}

export async function oauthRoutes(
    app: FastifyInstance
) {
    app.get("/authorize", async (request, reply) => {
        const query =
            authorizeQuerySchema.parse(
                request.query
            );

        const clientCheck =
            await validateAuthorizationClient(
                query.client_id,
                query.redirect_uri
            );

        if (clientCheck.result === "invalid") {
            throw new AppError(
                400,
                "INVALID_REQUEST",
                "Authorization request tidak valid"
            );
        }

        const validatedRedirectUri = query.redirect_uri;

        const requestCheck = validateAuthorizationRequest(query);

        if (requestCheck.result === "invalid") {
            const error =
                requestCheck.reason ===
                "UNSUPPORTED_RESPONSE_TYPE"
                    ? "unsupported_response_type"
                    : "invalid_request";

            return redirect(
                reply,
                buildRedirectUrl(
                    validatedRedirectUri,
                    {
                        error,
                        state: query.state
                    }
                )
            );
        }

        const rawSessionToken =
            request.cookies[
                env.SSO_COOKIE_NAME
            ];

        if (!rawSessionToken) {
            return redirect(
                reply,
                buildLoginRedirect(
                    request.raw.url
                )
            );
        }

        const policyResult =
            await evaluatePrevalidatedPolicy({
                rawSessionToken,
                applicationId:
                    clientCheck.application.id
            });

        if (
            policyResult.decision === "deny" &&
            (
                policyResult.reason ===
                    "INVALID_CENTRAL_SESSION" ||
                policyResult.reason ===
                    "USER_INACTIVE"
            )
        ) {
            reply.clearCookie(
                env.SSO_COOKIE_NAME,
                {
                    path: "/"
                }
            );

            return redirect(
                reply,
                buildLoginRedirect(
                    request.raw.url
                )
            );
        }

        if (policyResult.decision === "deny") {
            await writeAuditBestEffort(
                {
                    eventType: "policy_denied",
                    actorId: policyResult.userId,
                    userId: policyResult.userId,
                    applicationId:
                        clientCheck.application.id,
                    sessionId:
                        policyResult.centralSessionId,
                    result: "denied",
                    metadata: {
                        reason: policyResult.reason
                    },
                    ipAddress: request.ip
                },
                request.log
            );

            return redirect(
                reply,
                buildRedirectUrl(
                    validatedRedirectUri,
                    {
                        error: "access_denied",
                        state: query.state
                    }
                )
            );
        }

        const issued =
            await issueAuthorizationCode({
                userId: policyResult.userId,
                applicationId:
                    clientCheck.application.id,
                centralSessionId:
                    policyResult.centralSessionId,
                redirectUri:
                    validatedRedirectUri,
                codeChallenge:
                    query.code_challenge,
                ipAddress: request.ip
            });

        return redirect(
            reply,
            buildRedirectUrl(
                validatedRedirectUri,
                {
                    code: issued.rawCode,
                    state: query.state
                }
            )
        );
    });

    app.post("/token", async (request) => {
        const body =
            tokenRequestSchema.parse(
                request.body
            );

        const grantTypeCheck =
            validateTokenGrantType(
                body.grant_type
            );

        if (grantTypeCheck.result === "invalid") {
            throw new AppError(
                400,
                "INVALID_GRANT",
                "Authorization grant tidak valid"
            );
        }

        const clientCheck =
            await validateTokenClient(
                body.client_id,
                body.client_secret
            );

        if (clientCheck.result === "invalid") {
            throw new AppError(
                401,
                "INVALID_CLIENT",
                "Client tidak valid"
            );
        }

        const exchangeResult =
            await exchangeAuthorizationCode({
                applicationId:
                    clientCheck.application.id,
                clientId:
                    clientCheck.application.clientId,
                code: body.code,
                redirectUri:
                    body.redirect_uri,
                codeVerifier:
                    body.code_verifier,
                ipAddress: request.ip
            });

        if (exchangeResult.result === "invalid") {
            throw new AppError(
                400,
                "INVALID_GRANT",
                "Authorization grant tidak valid"
            );
        }

        return {
            access_token:
                exchangeResult.accessToken,
            token_type: "Bearer",
            expires_in:
                exchangeResult.expiresIn
        };
    });

    app.get("/userinfo", async (request) => {
        const headersCheck =
            userinfoHeadersSchema.safeParse(
                request.headers
            );

        if (!headersCheck.success) {
            throw new AppError(
                401,
                "UNAUTHORIZED",
                "Kredensial tidak valid"
            );
        }

        const bearerCheck =
            parseBearerToken(
                headersCheck.data.authorization
            );

        if (bearerCheck.result === "invalid") {
            throw new AppError(
                401,
                "UNAUTHORIZED",
                "Kredensial tidak valid"
            );
        }

        const accessCheck =
            await validateUserinfoAccess({
                accessToken:
                    bearerCheck.accessToken,
                clientId:
                    headersCheck.data[
                        "x-client-id"
                    ],
                clientSecret:
                    headersCheck.data[
                        "x-client-secret"
                    ]
            });

        if (accessCheck.result === "invalid") {
            throw new AppError(
                401,
                "UNAUTHORIZED",
                "Kredensial tidak valid"
            );
        }

        return {
            sub: accessCheck.user.id,
            name: accessCheck.user.name,
            email: accessCheck.user.email,
            groups: accessCheck.groups,
            centralSessionId: accessCheck.centralSessionId,
            clientId: accessCheck.application.clientId
        };
    });
}