import {
    and,
    eq,
    exists
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    applicationGroupPolicies,
    applicationRedirectUris,
    applications,
    ssoSessions,
    userGroups,
    users
} from "../../db/schema/index.js";

import { hashOpaqueValue } from "../../security/token.js";

export type EvaluatePolicyInput = {
    userId: string;
    clientId: string;
    redirectUri: string;
    centralSessionId: string;
};

export type PolicyDenyReason =
    | "APPLICATION_NOT_FOUND"
    | "APPLICATION_INACTIVE"
    | "INVALID_REDIRECT_URI"
    | "USER_INACTIVE"
    | "INVALID_CENTRAL_SESSION"
    | "NO_ALLOW_POLICY";

export type PolicyEvaluationResult =
    | {
        decision: "allow";
        applicationId: string;
    }
    | {
        decision: "deny";
        reason: PolicyDenyReason;
        applicationId: string | null;
    };

export async function evaluatePolicy(
    input: EvaluatePolicyInput
): Promise<PolicyEvaluationResult> {
    const allowPolicyQuery = db
        .select({
            id: userGroups.id
        })
        .from(userGroups)
        .innerJoin(
            applicationGroupPolicies,
            and(
                eq(
                    applicationGroupPolicies.groupId,
                    userGroups.groupId
                ),
                eq(
                    applicationGroupPolicies.effect,
                    "allow"
                ),
                eq(
                    applicationGroupPolicies.applicationId,
                    applications.id
                )
            )
        )
        .where(
            eq(
                userGroups.userId,
                input.userId
            )
        )
        .limit(1);

    const [result] = await db
        .select({
            applicationId: applications.id,
            applicationStatus: applications.status,
            redirectUriId: applicationRedirectUris.id,
            userId: users.id,
            userStatus: users.status,
            sessionId: ssoSessions.id,
            sessionStatus: ssoSessions.status,
            sessionExpiresAt: ssoSessions.expiresAt,
            sessionRevokedAt: ssoSessions.revokedAt,
            hasAllowPolicy: exists(allowPolicyQuery)
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
                    input.redirectUri
                )
            )
        )
        .leftJoin(
            users,
            eq(
                users.id,
                input.userId
            )
        )
        .leftJoin(
            ssoSessions,
            and(
                eq(
                    ssoSessions.id,
                    input.centralSessionId
                ),
                eq(
                    ssoSessions.userId,
                    input.userId
                )
            )
        )
        .where(
            eq(
                applications.clientId,
                input.clientId
            )
        )
        .limit(1);

    // 1. application exists?
    if (!result) {
        return {
            decision: "deny",
            reason: "APPLICATION_NOT_FOUND",
            applicationId: null
        };
    }

    // 2. application active?
    if (result.applicationStatus !== "active") {
        return {
            decision: "deny",
            reason: "APPLICATION_INACTIVE",
            applicationId: result.applicationId
        };
    }

    // 3. redirect_uri exact match?
    if (result.redirectUriId === null) {
        return {
            decision: "deny",
            reason: "INVALID_REDIRECT_URI",
            applicationId: result.applicationId
        };
    }

    // 4. user active?
    if (
        result.userId === null ||
        result.userStatus !== "active"
    ) {
        return {
            decision: "deny",
            reason: "USER_INACTIVE",
            applicationId: result.applicationId
        };
    }

    // 5. central session valid?
    if (
        result.sessionId === null ||
        result.sessionStatus !== "active" ||
        result.sessionRevokedAt !== null ||
        result.sessionExpiresAt === null ||
        result.sessionExpiresAt <= new Date()
    ) {
        return {
            decision: "deny",
            reason: "INVALID_CENTRAL_SESSION",
            applicationId: result.applicationId
        };
    }

    // 6 + 7. User memiliki group yang terhubung ke allow policy application?
    if (!result.hasAllowPolicy) {
        return {
            decision: "deny",
            reason: "NO_ALLOW_POLICY",
            applicationId: result.applicationId
        };
    }

    return {
        decision: "allow",
        applicationId: result.applicationId
    };
}

export type EvaluatePrevalidatedPolicyInput = {
    rawSessionToken: string;
    applicationId: string;
};

export type PrevalidatedPolicyEvaluationResult =
    | {
        decision: "allow";
        userId: string;
        centralSessionId: string;
    }
    | {
        decision: "deny";
        reason:
            | "USER_INACTIVE"
            | "INVALID_CENTRAL_SESSION"
            | "NO_ALLOW_POLICY";
    };

export async function evaluatePrevalidatedPolicy(
    input: EvaluatePrevalidatedPolicyInput
): Promise<PrevalidatedPolicyEvaluationResult> {
    const sessionTokenHash =
        hashOpaqueValue(input.rawSessionToken);

    const allowPolicyQuery = db
        .select({
            id: userGroups.id
        })
        .from(userGroups)
        .innerJoin(
            applicationGroupPolicies,
            and(
                eq(
                    applicationGroupPolicies.groupId,
                    userGroups.groupId
                ),
                eq(
                    applicationGroupPolicies.applicationId,
                    input.applicationId
                ),
                eq(
                    applicationGroupPolicies.effect,
                    "allow"
                )
            )
        )
        .where(
            eq(
                userGroups.userId,
                ssoSessions.userId
            )
        )
        .limit(1);

    const [result] = await db
        .select({
            userId: users.id,
            userStatus: users.status,

            sessionId: ssoSessions.id,
            sessionStatus: ssoSessions.status,
            sessionExpiresAt:
                ssoSessions.expiresAt,
            sessionRevokedAt:
                ssoSessions.revokedAt,

            hasAllowPolicy:
                exists(allowPolicyQuery)
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
            eq(
                ssoSessions.sessionTokenHash,
                sessionTokenHash
            )
        )
        .limit(1);

    if (!result) {
        return {
            decision: "deny",
            reason: "INVALID_CENTRAL_SESSION"
        };
    }

    if (result.userStatus !== "active") {
        return {
            decision: "deny",
            reason: "USER_INACTIVE"
        };
    }

    const now = new Date();

    if (
        result.sessionStatus !== "active" ||
        result.sessionRevokedAt !== null ||
        result.sessionExpiresAt <= now
    ) {
        return {
            decision: "deny",
            reason: "INVALID_CENTRAL_SESSION"
        };
    }

    if (!result.hasAllowPolicy) {
        return {
            decision: "deny",
            reason: "NO_ALLOW_POLICY"
        };
    }

    return {
        decision: "allow",
        userId: result.userId,
        centralSessionId: result.sessionId
    };
}