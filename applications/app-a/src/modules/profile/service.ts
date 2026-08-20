import { db } from "../../db/client.js";
import { profileCache } from "../../db/schema.js";

type ProfileWriteExecutor =
    Pick<typeof db, "insert">;

type UpsertProfileInput = {
    externalUserId: string;
    name: string;
    email: string;
    groups: string[];
};

export async function upsertProfileCache(
    input: UpsertProfileInput,
    executor: ProfileWriteExecutor = db
) {
    const now = new Date();

    const [profile] = await executor
        .insert(profileCache)
        .values({
            externalUserId: input.externalUserId,
            name: input.name,
            email: input.email,
            groups: input.groups,
            syncedAt: now,
            updatedAt: now
        })
        .onConflictDoUpdate({
            target: profileCache.externalUserId,
            set: {
                name: input.name,
                email: input.email,
                groups: input.groups,
                syncedAt: now,
                updatedAt: now
            }
        })
        .returning();

    if (!profile) {
        throw new Error("Failed to synchronize profile cache");
    }

    return profile;
}