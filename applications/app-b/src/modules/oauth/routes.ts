import type {
    FastifyInstance,
    FastifyReply
} from "fastify";

import {
    AuthProviderClientError,
    exchangeAuthorizationCode,
    fetchUserInfo
} from "../../auth-provider/client.js";
import { applicationConfig } from "../../config/application.js";
import { db } from "../../db/client.js";
import { renderErrorPage } from "../../http/html.js";
import { writeActivity } from "../activity/service.js";
import { upsertProfileCache } from "../profile/service.js";
import {
    createLocalSession,
    validateLocalSession
} from "../sessions/service.js";
import { callbackQuerySchema } from "./schemas.js";
import {
    cleanupExpiredOAuthTransactions,
    consumeOAuthTransaction,
    createOAuthTransaction
} from "./service.js";

function sendBrowserError(
    reply: FastifyReply,
    input: {
        statusCode: number;
        code: string;
        message: string;
        requestId: string;
    }
) {
    return reply
        .code(input.statusCode)
        .type("text/html; charset=utf-8")
        .send(
            renderErrorPage({
                applicationName:
                    applicationConfig.name,
                code: input.code,
                message: input.message,
                requestId: input.requestId
            })
        );
}

export function registerOAuthRoutes(
    app: FastifyInstance
) {
    app.get("/login", async (request, reply) => {
        const rawSessionToken =
            request.cookies[
                applicationConfig.cookieName
            ];

        if (rawSessionToken) {
            const localSession =
                await validateLocalSession(
                    rawSessionToken
                );

            if (localSession) {
                return reply.redirect("/");
            }
        }

        const authorization =
            await db.transaction(async (tx) => {
                await cleanupExpiredOAuthTransactions(
                    tx
                );

                const oauthTransaction =
                    await createOAuthTransaction(tx);

                await writeActivity(
                    {
                        eventType:
                            "authorization_started",
                        message:
                            "Authorization flow started",
                        requestId: request.id
                    },
                    tx
                );

                return oauthTransaction;
            });

        return reply.redirect(
            authorization.authorizationUrl
        );
    });

    app.get("/callback", async (request, reply) => {
        const parsed =
            callbackQuerySchema.safeParse(
                request.query
            );

        if (!parsed.success) {
            await writeActivity({
                eventType:
                    "oauth_state_invalid",
                message:
                    "OAuth callback rejected because state was missing or invalid",
                requestId: request.id
            });

            return sendBrowserError(reply, {
                statusCode: 400,
                code: "INVALID_CALLBACK",
                message:
                    "Proses autentikasi tidak dapat diselesaikan",
                requestId: request.id
            });
        }

        const query = parsed.data;

        if (!query.state) {
            await writeActivity({
                eventType:
                    "oauth_state_invalid",
                message:
                    "OAuth callback rejected because state was missing or invalid",
                requestId: request.id
            });

            return sendBrowserError(reply, {
                statusCode: 400,
                code: "INVALID_CALLBACK",
                message:
                    "Proses autentikasi tidak dapat diselesaikan",
                requestId: request.id
            });
        }

        const oauthTransaction =
            await consumeOAuthTransaction(
                query.state
            );

        if (!oauthTransaction) {
            await writeActivity({
                eventType:
                    "oauth_state_invalid",
                message:
                    "OAuth callback rejected because state was invalid or expired",
                requestId: request.id
            });

            return sendBrowserError(reply, {
                statusCode: 400,
                code: "INVALID_CALLBACK",
                message:
                    "Proses autentikasi tidak dapat diselesaikan",
                requestId: request.id
            });
        }

        await writeActivity({
            eventType: "callback_received",
            message:
                "Authorization callback received",
            requestId: request.id,
            metadata: {
                result:
                    query.error
                        ? "error"
                        : query.code
                          ? "code"
                          : "invalid"
            }
        });

        if (query.error && query.code) {
            return sendBrowserError(reply, {
                statusCode: 400,
                code: "INVALID_CALLBACK",
                message:
                    "Proses autentikasi tidak dapat diselesaikan",
                requestId: request.id
            });
        }

        if (query.error) {
            await writeActivity({
                eventType:
                    "authorization_denied",
                message:
                    "Authorization request was denied",
                requestId: request.id,
                metadata: {
                    result: "denied"
                }
            });

            return sendBrowserError(reply, {
                statusCode: 403,
                code: "ACCESS_DENIED",
                message:
                    "Anda tidak memiliki akses ke aplikasi ini.",
                requestId: request.id
            });
        }

        if (!query.code) {
            return sendBrowserError(reply, {
                statusCode: 400,
                code: "INVALID_CALLBACK",
                message:
                    "Proses autentikasi tidak dapat diselesaikan",
                requestId: request.id
            });
        }

        let accessToken: string;

        try {
            const tokenResult =
                await exchangeAuthorizationCode({
                    code: query.code,
                    codeVerifier:
                        oauthTransaction.codeVerifier
                });

            accessToken =
                tokenResult.accessToken;

            await writeActivity({
                eventType:
                    "token_exchange_succeeded",
                message:
                    "Authorization code exchanged successfully",
                requestId: request.id
            });
        } catch (error) {
            if (
                error instanceof
                AuthProviderClientError
            ) {
                request.log.warn(
                    {
                        operation:
                            error.operation,
                        reason:
                            error.reason,
                        upstreamStatus:
                            error.upstreamStatus
                    },
                    "Auth Provider token exchange failed"
                );
            } else {
                request.log.error(
                    "Unexpected token exchange failure"
                );
            }

            await writeActivity({
                eventType:
                    "token_exchange_failed",
                message:
                    "Authorization code exchange failed",
                requestId: request.id
            });

            return sendBrowserError(reply, {
                statusCode: 400,
                code: "TOKEN_EXCHANGE_FAILED",
                message:
                    "Proses autentikasi tidak dapat diselesaikan",
                requestId: request.id
            });
        }

        let userInfo;

        try {
            userInfo =
                await fetchUserInfo(
                    accessToken
                );

            await writeActivity({
                eventType:
                    "userinfo_fetched",
                message:
                    "User information fetched successfully",
                externalUserId:
                    userInfo.sub,
                requestId: request.id
            });
        } catch (error) {
            if (
                error instanceof
                AuthProviderClientError
            ) {
                request.log.warn(
                    {
                        operation:
                            error.operation,
                        reason:
                            error.reason,
                        upstreamStatus:
                            error.upstreamStatus
                    },
                    "Auth Provider userinfo request failed"
                );
            } else {
                request.log.error(
                    "Unexpected userinfo failure"
                );
            }

            await writeActivity({
                eventType:
                    "userinfo_failed",
                message:
                    "User information request failed",
                requestId: request.id
            });

            return sendBrowserError(reply, {
                statusCode: 502,
                code: "USERINFO_FAILED",
                message:
                    "Informasi pengguna tidak dapat diperoleh",
                requestId: request.id
            });
        }

        let localSession;

        try {
            localSession =
                await db.transaction(
                    async (tx) => {
                        await upsertProfileCache(
                            {
                                externalUserId:
                                    userInfo.sub,
                                name:
                                    userInfo.name,
                                email:
                                    userInfo.email,
                                groups:
                                    userInfo.groups
                            },
                            tx
                        );

                        const createdSession =
                            await createLocalSession(
                                {
                                    externalUserId:
                                        userInfo.sub,
                                    centralSessionId:
                                        userInfo.centralSessionId
                                },
                                tx
                            );

                        await writeActivity(
                            {
                                eventType:
                                    "profile_synced",
                                message:
                                    "Profile cache synchronized",
                                externalUserId:
                                    userInfo.sub,
                                requestId:
                                    request.id
                            },
                            tx
                        );

                        await writeActivity(
                            {
                                eventType:
                                    "local_session_created",
                                message:
                                    "Local session created",
                                externalUserId:
                                    userInfo.sub,
                                requestId:
                                    request.id
                            },
                            tx
                        );

                        return createdSession;
                    }
                );
        } catch {
            request.log.error(
                "Failed to persist callback result"
            );

            return sendBrowserError(reply, {
                statusCode: 500,
                code: "LOCAL_SESSION_FAILED",
                message:
                    "Local session tidak dapat dibuat",
                requestId: request.id
            });
        }

        reply.setCookie(
            applicationConfig.cookieName,
            localSession.rawToken,
            {
                httpOnly: true,
                sameSite: "lax",
                secure:
                    applicationConfig.nodeEnv ===
                    "production",
                path: "/",
                maxAge:
                    applicationConfig.sessionTtlSeconds
            }
        );

        return reply.redirect("/");
    });
}