import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { processedEvents } from "../../db/schema.js";
import { writeActivity } from "../activity/service.js";
import {
    revokeAllUserLocalSessions,
    revokeSessionsByCentralSessionId
} from "../sessions/service.js";
import type { InternalLogoutEvent } from "./schemas.js";

export async function processInternalLogout(
    event: InternalLogoutEvent,
    requestId: string
) {
    return db.transaction(async (tx) => {
        const [claimed] = await tx
            .insert(processedEvents)
            .values({
                eventId: event.eventId,
                eventType: event.eventType,
                result: "processing",
                action: "Pending"
            })
            .onConflictDoNothing({
                target: processedEvents.eventId
            })
            .returning({
                eventId: processedEvents.eventId
            });

        if (!claimed) {
            return {
                duplicate: true,
                revokedSessions: 0
            };
        }

        let revokedSessions: number;

        switch (event.eventType) {
            case "SessionRevoked":
                if (event.centralSessionId) {
                    revokedSessions =
                        await revokeSessionsByCentralSessionId(
                            event.centralSessionId,
                            event.reason,
                            tx
                        );
                } else {
                    revokedSessions =
                        await revokeAllUserLocalSessions(
                            event.userId,
                            event.reason,
                            tx
                        );
                }
                break;

            case "PasswordChanged":
            case "AccessPolicyChanged":
                revokedSessions =
                    await revokeAllUserLocalSessions(
                        event.userId,
                        event.reason,
                        tx
                    );
                break;
        }

        const action =
            `Revoked ${revokedSessions} local session(s)`;

        await tx
            .update(processedEvents)
            .set({
                result: "success",
                action,
                processedAt: new Date()
            })
            .where(
                eq(
                    processedEvents.eventId,
                    event.eventId
                )
            );

        await writeActivity(
            {
                eventType:
                    "internal_logout_processed",
                message:
                    "Internal logout event processed",
                externalUserId:
                    event.userId,
                requestId,
                metadata: {
                    eventId: event.eventId,
                    eventType: event.eventType,
                    revokedSessions
                }
            },
            tx
        );

        return {
            duplicate: false,
            revokedSessions
        };
    });
}