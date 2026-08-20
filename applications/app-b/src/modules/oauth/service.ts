import {
    and,
    eq,
    gt,
    lte
} from "drizzle-orm";

import { applicationConfig } from "../../config/application.js";
import { db } from "../../db/client.js";
import { oauthTransactions } from "../../db/schema.js";
import {
    createCodeChallenge,
    generateCodeVerifier
} from "../../security/pkce.js";
import {
    generateOpaqueValue,
    hashOpaqueValue
} from "../../security/token.js";

type OAuthWriteExecutor =
    Pick<typeof db, "delete" | "insert">;

export async function cleanupExpiredOAuthTransactions(
    executor: OAuthWriteExecutor = db
) {
    await executor
        .delete(oauthTransactions)
        .where(
            lte(
                oauthTransactions.expiresAt,
                new Date()
            )
        );
}

export async function consumeOAuthTransaction(
    rawState: string,
    executor: OAuthWriteExecutor = db
) {
    const stateHash = hashOpaqueValue(rawState);
    const now = new Date();

    const [transaction] = await executor
        .delete(oauthTransactions)
        .where(
            and(
                eq(
                    oauthTransactions.stateHash,
                    stateHash
                ),
                gt(
                    oauthTransactions.expiresAt,
                    now
                )
            )
        )
        .returning({
            codeVerifier:
                oauthTransactions.codeVerifier
        });

    return transaction ?? null;
}

export async function createOAuthTransaction(
    executor: OAuthWriteExecutor = db
) {
    const rawState = generateOpaqueValue();
    const stateHash = hashOpaqueValue(rawState);

    const codeVerifier = generateCodeVerifier();
    const codeChallenge =
        createCodeChallenge(codeVerifier);

    const expiresAt = new Date(
        Date.now() +
        applicationConfig.oauthTransactionTtlSeconds *
            1000
    );

    const [transaction] = await executor
        .insert(oauthTransactions)
        .values({
            stateHash,
            codeVerifier,
            expiresAt
        })
        .returning({
            id: oauthTransactions.id
        });

    if (!transaction) {
        throw new Error(
            "Failed to create OAuth transaction"
        );
    }

    const authorizationUrl = new URL(
        "/authorize",
        applicationConfig.authServerPublicUrl
    );

    authorizationUrl.searchParams.set(
        "response_type",
        "code"
    );
    authorizationUrl.searchParams.set(
        "client_id",
        applicationConfig.clientId
    );
    authorizationUrl.searchParams.set(
        "redirect_uri",
        applicationConfig.redirectUri
    );
    authorizationUrl.searchParams.set(
        "state",
        rawState
    );
    authorizationUrl.searchParams.set(
        "code_challenge",
        codeChallenge
    );
    authorizationUrl.searchParams.set(
        "code_challenge_method",
        "S256"
    );

    return {
        authorizationUrl: authorizationUrl.toString()
    };
}