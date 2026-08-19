import {
    and,
    eq,
    inArray,
    isNull
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    accessTokens,
    ssoSessions
} from "../../db/schema/index.js";

type RevocationExecutor =
    Pick<typeof db, "update">;

type RevokeCentralSessionInput = {
    sessionId: string;
    reason: string;
};

type RevokeAllUserSessionsInput = {
    userId: string;
    reason: string;
};

type RevokeUserApplicationAccessInput = {
    userId: string;
    applicationId: string;
};

type RevokeUserApplicationsAccessInput = {
    userId: string;
    applicationIds: string[];
};

type RevokeUsersApplicationAccessInput = {
    userIds: string[];
    applicationId: string;
};

type RevokeApplicationAccessInput = {
    applicationId: string;
};

async function revokeCentralSessionWithExecutor(
    input: RevokeCentralSessionInput,
    executor: RevocationExecutor
) {
    const now = new Date();

    const revokedSessions = await executor
        .update(ssoSessions)
        .set({
            status: "revoked",
            revokedAt: now,
            revokeReason: input.reason
        })
        .where(
            and(
                eq(ssoSessions.id, input.sessionId),
                eq(ssoSessions.status, "active"),
                isNull(ssoSessions.revokedAt)
            )
        )
        .returning({
            id: ssoSessions.id
        });

    const revokedTokens = await executor
        .update(accessTokens)
        .set({
            status: "revoked",
            revokedAt: now
        })
        .where(
            and(
                eq(
                    accessTokens.ssoSessionId,
                    input.sessionId
                ),
                eq(accessTokens.status, "active"),
                isNull(accessTokens.revokedAt)
            )
        )
        .returning({
            id: accessTokens.id
        });

    return {
        revokedSessionCount:
            revokedSessions.length,
        revokedTokenCount:
            revokedTokens.length
    };
}

async function revokeAllUserSessionsWithExecutor(
    input: RevokeAllUserSessionsInput,
    executor: RevocationExecutor
) {
    const now = new Date();

    const revokedSessions = await executor
        .update(ssoSessions)
        .set({
            status: "revoked",
            revokedAt: now,
            revokeReason: input.reason
        })
        .where(
            and(
                eq(ssoSessions.userId, input.userId),
                eq(ssoSessions.status, "active"),
                isNull(ssoSessions.revokedAt)
            )
        )
        .returning({
            id: ssoSessions.id
        });

    const revokedTokens = await executor
        .update(accessTokens)
        .set({
            status: "revoked",
            revokedAt: now
        })
        .where(
            and(
                eq(accessTokens.userId, input.userId),
                eq(accessTokens.status, "active"),
                isNull(accessTokens.revokedAt)
            )
        )
        .returning({
            id: accessTokens.id
        });

    return {
        revokedSessionCount:
            revokedSessions.length,
        revokedTokenCount:
            revokedTokens.length
    };
}

async function revokeUserApplicationAccessWithExecutor(
    input: RevokeUserApplicationAccessInput,
    executor: RevocationExecutor
) {
    const now = new Date();

    const revokedTokens = await executor
        .update(accessTokens)
        .set({
            status: "revoked",
            revokedAt: now
        })
        .where(
            and(
                eq(accessTokens.userId, input.userId),
                eq(
                    accessTokens.applicationId,
                    input.applicationId
                ),
                eq(accessTokens.status, "active"),
                isNull(accessTokens.revokedAt)
            )
        )
        .returning({
            id: accessTokens.id
        });

    return {
        revokedTokenCount:
            revokedTokens.length
    };
}

async function revokeUserApplicationsAccessWithExecutor(
    input: RevokeUserApplicationsAccessInput,
    executor: RevocationExecutor
) {
    if (input.applicationIds.length === 0) {
        return {
            revokedTokenCount: 0
        };
    }

    const now = new Date();

    const revokedTokens = await executor
        .update(accessTokens)
        .set({
            status: "revoked",
            revokedAt: now
        })
        .where(
            and(
                eq(
                    accessTokens.userId,
                    input.userId
                ),
                inArray(
                    accessTokens.applicationId,
                    input.applicationIds
                ),
                eq(accessTokens.status, "active"),
                isNull(accessTokens.revokedAt)
            )
        )
        .returning({
            id: accessTokens.id
        });

    return {
        revokedTokenCount:
            revokedTokens.length
    };
}

async function revokeUsersApplicationAccessWithExecutor(
    input: RevokeUsersApplicationAccessInput,
    executor: RevocationExecutor
) {
    if (input.userIds.length === 0) {
        return {
            revokedTokenCount: 0
        };
    }

    const now = new Date();

    const revokedTokens = await executor
        .update(accessTokens)
        .set({
            status: "revoked",
            revokedAt: now
        })
        .where(
            and(
                inArray(
                    accessTokens.userId,
                    input.userIds
                ),
                eq(
                    accessTokens.applicationId,
                    input.applicationId
                ),
                eq(accessTokens.status, "active"),
                isNull(accessTokens.revokedAt)
            )
        )
        .returning({
            id: accessTokens.id
        });

    return {
        revokedTokenCount:
            revokedTokens.length
    };
}

async function revokeApplicationAccessWithExecutor(
    input: RevokeApplicationAccessInput,
    executor: RevocationExecutor
) {
    const now = new Date();

    const revokedTokens = await executor
        .update(accessTokens)
        .set({
            status: "revoked",
            revokedAt: now
        })
        .where(
            and(
                eq(accessTokens.applicationId, input.applicationId),
                eq(accessTokens.status, "active"),
                isNull(accessTokens.revokedAt)
            )
        )
        .returning({
            userId: accessTokens.userId
        });

    const affectedUserIds = [
        ...new Set(
            revokedTokens.map(({ userId }) => userId)
        )
    ];

    return {
        revokedTokenCount: revokedTokens.length,
        affectedUserIds
    };
}

export async function revokeCentralSession(
    input: RevokeCentralSessionInput,
    executor?: RevocationExecutor
) {
    if (executor) {
        return revokeCentralSessionWithExecutor(
            input,
            executor
        );
    }

    return db.transaction(async (tx) =>
        revokeCentralSessionWithExecutor(
            input,
            tx
        )
    );
}

export async function revokeAllUserSessions(
    input: RevokeAllUserSessionsInput,
    executor?: RevocationExecutor
) {
    if (executor) {
        return revokeAllUserSessionsWithExecutor(
            input,
            executor
        );
    }

    return db.transaction(async (tx) =>
        revokeAllUserSessionsWithExecutor(
            input,
            tx
        )
    );
}

export async function revokeUserApplicationAccess(
    input: RevokeUserApplicationAccessInput,
    executor?: RevocationExecutor
) {
    if (executor) {
        return revokeUserApplicationAccessWithExecutor(
            input,
            executor
        );
    }

    return db.transaction(async (tx) =>
        revokeUserApplicationAccessWithExecutor(
            input,
            tx
        )
    );
}

export async function revokeUserApplicationsAccess(
    input: RevokeUserApplicationsAccessInput,
    executor?: RevocationExecutor
) {
    if (executor) {
        return revokeUserApplicationsAccessWithExecutor(
            input,
            executor
        );
    }

    return db.transaction(async (tx) =>
        revokeUserApplicationsAccessWithExecutor(
            input,
            tx
        )
    );
}

export async function revokeUsersApplicationAccess(
    input: RevokeUsersApplicationAccessInput,
    executor?: RevocationExecutor
) {
    if (executor) {
        return revokeUsersApplicationAccessWithExecutor(
            input,
            executor
        );
    }

    return db.transaction(async (tx) =>
        revokeUsersApplicationAccessWithExecutor(
            input,
            tx
        )
    );
}

export async function revokeApplicationAccess(
    input: RevokeApplicationAccessInput,
    executor?: RevocationExecutor
) {
    if (executor) {
        return revokeApplicationAccessWithExecutor(input, executor);
    }

    return db.transaction(async (tx) =>
        revokeApplicationAccessWithExecutor(input, tx)
    );
}