import {
    and,
    eq
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    applicationRedirectUris,
    applications
} from "../../db/schema/index.js";
import { env } from "../../config/env.js";
import { authorizationCodes } from "../../db/schema/index.js";
import {
    generateOpaqueValue,
    hashOpaqueValue
} from "../../security/token.js";
import type { AuthorizeQuery } from "./schemas.js";

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