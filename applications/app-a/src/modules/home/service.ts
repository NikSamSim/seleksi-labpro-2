import { desc } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    activityLogs,
    processedEvents
} from "../../db/schema.js";

const HOME_LIST_LIMIT = 50;

export async function getRecentActivityLogs() {
    return db
        .select({
            id: activityLogs.id,
            eventType: activityLogs.eventType,
            message: activityLogs.message,
            externalUserId:
                activityLogs.externalUserId,
            requestId: activityLogs.requestId,
            createdAt: activityLogs.createdAt
        })
        .from(activityLogs)
        .orderBy(desc(activityLogs.createdAt))
        .limit(HOME_LIST_LIMIT);
}

export async function getRecentProcessedEvents() {
    return db
        .select({
            eventId: processedEvents.eventId,
            eventType: processedEvents.eventType,
            processedAt: processedEvents.processedAt,
            result: processedEvents.result,
            action: processedEvents.action
        })
        .from(processedEvents)
        .orderBy(desc(processedEvents.processedAt))
        .limit(HOME_LIST_LIMIT);
}