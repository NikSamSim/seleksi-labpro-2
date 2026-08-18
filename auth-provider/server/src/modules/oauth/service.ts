import {
    and,
    eq,
    exists,
    gt,
    isNull
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    accessTokens,
    applicationRedirectUris,
    applications,
    authorizationCodes,
    groups,
    ssoSessions,
    userGroups,
    users
} from "../../db/schema/index.js";
import { env } from "../../config/env.js";
import {
    generateOpaqueValue,
    hashOpaqueValue
} from "../../security/token.js";
import type { AuthorizeQuery } from "./schemas.js";
import {
    verifyClientSecret
} from "../../security/client-secret.js";

import {
    verifyPkceChallenge
} from "../../security/pkce.js";

export type AuthorizationClientCheck =
    | {
        result: "valid";
        application: {
            id: string;
            clientId: string;
        };
    }
    | {
        result: "invalid";
        reason:
            | "APPLICATION_NOT_FOUND"
            | "APPLICATION_INACTIVE"
            | "INVALID_REDIRECT_URI";
    };

export type TokenClientCheck =
    | {
        result: "valid";
        application: {
            id: string;
            clientId: string;
        };
    }
    | {
        result: "invalid";
        reason:
            | "APPLICATION_NOT_FOUND"
            | "APPLICATION_INACTIVE"
            | "INVALID_CLIENT_SECRET";
    };

export type TokenGrantTypeCheck =
    | {
        result: "valid";
    }
    | {
        result: "invalid";
        reason: "UNSUPPORTED_GRANT_TYPE";
    };

export type BearerTokenCheck =
    | {
        result: "valid";
        accessToken: string;
    }
    | {
        result: "invalid";
    };

export type ValidateUserinfoAccessInput = {
    accessToken: string;
    clientId: string;
    clientSecret: string;
};

export type ValidateUserinfoAccessResult =
    | {
        result: "valid";
        user: {
            id: string;
            name: string;
            email: string;
        };
        application: {
            id: string;
            clientId: string;
        };
        centralSessionId: string;
        groups: string[];
    }
    | {
        result: "invalid";
    };

export type ExchangeAuthorizationCodeInput = {
    applicationId: string;
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
};

export type ExchangeAuthorizationCodeResult =
    | {
        result: "issued";
        accessToken: string;
        expiresIn: number;
    }
    | {
        result: "invalid";
    };

export type AuthorizationRequestCheck =
    | {
        result: "valid";
    }
    | {
        result: "invalid";
        reason:
            | "UNSUPPORTED_RESPONSE_TYPE"
            | "INVALID_PKCE_METHOD"
            | "INVALID_PKCE_CHALLENGE";
    };

export type IssueAuthorizationCodeInput = {
    userId: string;
    applicationId: string;
    centralSessionId: string;
    redirectUri: string;
    codeChallenge: string;
};

export async function validateAuthorizationClient(
    clientId: string,
    redirectUri: string
): Promise<AuthorizationClientCheck> {
    const [result] = await db
        .select({
            applicationId: applications.id,
            clientId: applications.clientId,
            applicationStatus: applications.status,
            redirectUriId:
                applicationRedirectUris.id
        })
        .from(applications)
        .leftJoin(
            applicationRedirectUris,
            and(
                eq(
                    applicationRedirectUris.applicationId,
                    applications.id
                ),
                eq(
                    applicationRedirectUris.redirectUri,
                    redirectUri
                )
            )
        )
        .where(
            eq(
                applications.clientId,
                clientId
            )
        )
        .limit(1);

    // 1. find client_id
    if (!result) {
        return {
            result: "invalid",
            reason: "APPLICATION_NOT_FOUND"
        };
    }

    // 2. application active?
    if (result.applicationStatus !== "active") {
        return {
            result: "invalid",
            reason: "APPLICATION_INACTIVE"
        };
    }

    // 3. redirect_uri exact-match?
    if (result.redirectUriId === null) {
        return {
            result: "invalid",
            reason: "INVALID_REDIRECT_URI"
        };
    }

    return {
        result: "valid",
        application: {
            id: result.applicationId,
            clientId: result.clientId
        }
    };
}

const S256_CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function validateAuthorizationRequest(
    query: AuthorizeQuery
): AuthorizationRequestCheck {
    // 4. response_type = code?
    if (query.response_type !== "code") {
        return {
            result: "invalid",
            reason: "UNSUPPORTED_RESPONSE_TYPE"
        };
    }

    // 5. PKCE method = S256?
    if (query.code_challenge_method !== "S256") {
        return {
            result: "invalid",
            reason: "INVALID_PKCE_METHOD"
        };
    }

    if (
        !S256_CODE_CHALLENGE_PATTERN.test(
            query.code_challenge
        )
    ) {
        return {
            result: "invalid",
            reason: "INVALID_PKCE_CHALLENGE"
        };
    }

    return {
        result: "valid"
    };
}

export function validateTokenGrantType(
    grantType: string
): TokenGrantTypeCheck {
    if (grantType !== "authorization_code") {
        return {
            result: "invalid",
            reason: "UNSUPPORTED_GRANT_TYPE"
        };
    }

    return {
        result: "valid"
    };
}

export function parseBearerToken(
    authorization: string
): BearerTokenCheck {
    const match =
        /^Bearer ([A-Za-z0-9_-]+)$/i.exec(
            authorization
        );

    if (!match) {
        return {
            result: "invalid"
        };
    }

    return {
        result: "valid",
        accessToken: match[1]
    };
}

export async function validateUserinfoAccess(
    input: ValidateUserinfoAccessInput
): Promise<ValidateUserinfoAccessResult> {
    const tokenHash =
        hashOpaqueValue(input.accessToken);

    const now = new Date();

    const [identity] = await db
        .select({
            userId: users.id,
            userName: users.name,
            userEmail: users.email,

            applicationId:
                applications.id,
            clientId:
                applications.clientId,
            clientSecretHash:
                applications.clientSecretHash,

            centralSessionId:
                ssoSessions.id
        })
        .from(accessTokens)
        .innerJoin(
            applications,
            and(
                eq(
                    applications.id,
                    accessTokens.applicationId
                ),
                eq(
                    applications.clientId,
                    input.clientId
                )
            )
        )
        .innerJoin(
            ssoSessions,
            and(
                eq(
                    ssoSessions.id,
                    accessTokens.ssoSessionId
                ),
                eq(
                    ssoSessions.userId,
                    accessTokens.userId
                )
            )
        )
        .innerJoin(
            users,
            eq(
                users.id,
                accessTokens.userId
            )
        )
        .where(
            and(
                eq(
                    accessTokens.tokenHash,
                    tokenHash
                ),
                eq(
                    accessTokens.status,
                    "active"
                ),
                gt(
                    accessTokens.expiresAt,
                    now
                ),
                isNull(
                    accessTokens.revokedAt
                ),

                eq(
                    applications.status,
                    "active"
                ),

                eq(
                    ssoSessions.status,
                    "active"
                ),
                gt(
                    ssoSessions.expiresAt,
                    now
                ),
                isNull(
                    ssoSessions.revokedAt
                ),

                eq(
                    users.status,
                    "active"
                )
            )
        )
        .limit(1);

    if (!identity) {
        return {
            result: "invalid"
        };
    }

    if (
        !verifyClientSecret(
            identity.clientSecretHash,
            input.clientSecret
        )
    ) {
        return {
            result: "invalid"
        };
    }

    const userGroupRows = await db
        .select({
            name: groups.name
        })
        .from(userGroups)
        .innerJoin(
            groups,
            eq(
                groups.id,
                userGroups.groupId
            )
        )
        .where(
            eq(
                userGroups.userId,
                identity.userId
            )
        );

    return {
        result: "valid",
        user: {
            id: identity.userId,
            name: identity.userName,
            email: identity.userEmail
        },
        application: {
            id: identity.applicationId,
            clientId: identity.clientId
        },
        centralSessionId:
            identity.centralSessionId,
        groups: userGroupRows.map(
            (group) => group.name
        )
    };
}

export async function validateTokenClient(
    clientId: string,
    clientSecret: string
): Promise<TokenClientCheck> {
    const [application] = await db
        .select({
            id: applications.id,
            clientId: applications.clientId,
            clientSecretHash:
                applications.clientSecretHash,
            status: applications.status
        })
        .from(applications)
        .where(
            eq(
                applications.clientId,
                clientId
            )
        )
        .limit(1);

    if (!application) {
        return {
            result: "invalid",
            reason: "APPLICATION_NOT_FOUND"
        };
    }

    if (application.status !== "active") {
        return {
            result: "invalid",
            reason: "APPLICATION_INACTIVE"
        };
    }

    if (
        !verifyClientSecret(
            application.clientSecretHash,
            clientSecret
        )
    ) {
        return {
            result: "invalid",
            reason: "INVALID_CLIENT_SECRET"
        };
    }

    return {
        result: "valid",
        application: {
            id: application.id,
            clientId: application.clientId
        }
    };
}

export async function exchangeAuthorizationCode(
    input: ExchangeAuthorizationCodeInput
): Promise<ExchangeAuthorizationCodeResult> {
    const codeHash =
        hashOpaqueValue(input.code);

    return db.transaction(async (tx) => {
        const now = new Date();

        const [authorizationCode] =
            await tx
                .select({
                    id: authorizationCodes.id,
                    userId:
                        authorizationCodes.userId,
                    applicationId:
                        authorizationCodes.applicationId,
                    ssoSessionId:
                        authorizationCodes.ssoSessionId,
                    codeChallenge:
                        authorizationCodes.codeChallenge
                })
                .from(authorizationCodes)
                .where(
                    and(
                        eq(
                            authorizationCodes.codeHash,
                            codeHash
                        ),
                        eq(
                            authorizationCodes.applicationId,
                            input.applicationId
                        ),
                        eq(
                            authorizationCodes.redirectUri,
                            input.redirectUri
                        ),
                        eq(
                            authorizationCodes.codeChallengeMethod,
                            "S256"
                        ),
                        isNull(
                            authorizationCodes.usedAt
                        ),
                        gt(
                            authorizationCodes.expiresAt,
                            now
                        )
                    )
                )
                .limit(1);

        if (!authorizationCode) {
            return {
                result: "invalid"
            };
        }

        if (
            !verifyPkceChallenge(
                input.codeVerifier,
                authorizationCode.codeChallenge
            )
        ) {
            return {
                result: "invalid"
            };
        }

        const validCentralSession = tx
            .select({
                id: ssoSessions.id
            })
            .from(ssoSessions)
            .innerJoin(
                users,
                eq(
                    users.id,
                    ssoSessions.userId
                )
            )
            .where(
                and(
                    eq(
                        ssoSessions.id,
                        authorizationCode.ssoSessionId
                    ),
                    eq(
                        ssoSessions.userId,
                        authorizationCode.userId
                    ),
                    eq(
                        ssoSessions.status,
                        "active"
                    ),
                    gt(
                        ssoSessions.expiresAt,
                        now
                    ),
                    isNull(
                        ssoSessions.revokedAt
                    ),
                    eq(
                        users.status,
                        "active"
                    )
                )
            );

        const activeApplication = tx
            .select({
                id: applications.id
            })
            .from(applications)
            .where(
                and(
                    eq(
                        applications.id,
                        input.applicationId
                    ),
                    eq(
                        applications.clientId,
                        input.clientId
                    ),
                    eq(
                        applications.status,
                        "active"
                    )
                )
            );

        const [consumedCode] =
            await tx
                .update(authorizationCodes)
                .set({
                    usedAt: now
                })
                .where(
                    and(
                        eq(
                            authorizationCodes.id,
                            authorizationCode.id
                        ),
                        eq(
                            authorizationCodes.applicationId,
                            input.applicationId
                        ),
                        eq(
                            authorizationCodes.redirectUri,
                            input.redirectUri
                        ),
                        isNull(
                            authorizationCodes.usedAt
                        ),
                        gt(
                            authorizationCodes.expiresAt,
                            now
                        ),
                        exists(
                            validCentralSession
                        ),
                        exists(
                            activeApplication
                        )
                    )
                )
                .returning({
                    userId:
                        authorizationCodes.userId,
                    applicationId:
                        authorizationCodes.applicationId,
                    ssoSessionId:
                        authorizationCodes.ssoSessionId
                });

        if (!consumedCode) {
            return {
                result: "invalid"
            };
        }

        const accessToken =
            generateOpaqueValue();

        const tokenHash =
            hashOpaqueValue(accessToken);

        const expiresAt = new Date(
            now.getTime() +
            env.ACCESS_TOKEN_TTL_SECONDS * 1000
        );

        await tx
            .insert(accessTokens)
            .values({
                tokenHash,
                userId: consumedCode.userId,
                applicationId:
                    consumedCode.applicationId,
                ssoSessionId:
                    consumedCode.ssoSessionId,
                expiresAt
            });

        return {
            result: "issued",
            accessToken,
            expiresIn:
                env.ACCESS_TOKEN_TTL_SECONDS
        };
    });
}

export async function issueAuthorizationCode(
    input: IssueAuthorizationCodeInput
) {
    const rawCode = generateOpaqueValue();
    const codeHash = hashOpaqueValue(rawCode);

    const now = new Date();

    const expiresAt = new Date(
        now.getTime() +
        env.AUTHORIZATION_CODE_TTL_SECONDS * 1000
    );

    const [authorizationCode] = await db
        .insert(authorizationCodes)
        .values({
            codeHash,
            userId: input.userId,
            applicationId: input.applicationId,
            ssoSessionId: input.centralSessionId,
            redirectUri: input.redirectUri,
            codeChallenge: input.codeChallenge,
            codeChallengeMethod: "S256",
            expiresAt
        })
        .returning({
            id: authorizationCodes.id,
            expiresAt: authorizationCodes.expiresAt
        });

    return {
        rawCode,
        authorizationCode
    };
}