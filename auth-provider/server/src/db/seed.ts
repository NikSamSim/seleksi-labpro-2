import { inArray } from "drizzle-orm";

import { env } from "../config/env.js";
import { hashPassword } from "../security/password.js";

import { db, closeDatabase } from "./client.js";
import {
    applicationGroupPolicies,
    applicationRedirectUris,
    applications,
    groups,
    userGroups,
    users
} from "./schema/index.js";

import { hashClientSecret } from "../security/client-secret.js";

async function seedGroups() {
    console.log("Seeding groups...");

    await db
        .insert(groups)
        .values([
            {
                name: "app-a-users",
                description: "Users allowed to access App A"
            },
            {
                name: "app-b-users",
                description: "Users allowed to access App B"
            }
        ])
        .onConflictDoNothing({
            target: groups.name
        });
}

const seedUserData = [
    {
        name: "App A Only User",
        email: "app-a-only@example.com",
        status: "active"
    },
    {
        name: "App B Only User",
        email: "app-b-only@example.com",
        status: "active"
    },
    {
        name: "Both Apps User",
        email: "both-apps@example.com",
        status: "active"
    },
    {
        name: "No Access User",
        email: "no-access@example.com",
        status: "active"
    },
    {
        name: "Inactive User",
        email: "inactive@example.com",
        status: "inactive"
    }
];

async function seedUsers() {
    console.log("Seeding users...");

    const emails = seedUserData.map((user) => user.email);

    const existingUsers = await db
        .select({
            email: users.email
        })
        .from(users)
        .where(inArray(users.email, emails));

    const existingEmails = new Set(
        existingUsers.map((user) => user.email)
    );

    const missingUsers = seedUserData.filter(
        (user) => !existingEmails.has(user.email)
    );

    if (missingUsers.length === 0) {
        return;
    }

    const usersToInsert = await Promise.all(
        missingUsers.map(async (user) => ({
            ...user,
            passwordHash: await hashPassword(env.SEED_USER_PASSWORD)
        }))
    );

    await db
        .insert(users)
        .values(usersToInsert)
        .onConflictDoNothing({
            target: users.email
        });
}

async function seedMemberships() {
    console.log("Seeding user memberships...");

    const membershipUserEmails = [
        "app-a-only@example.com",
        "app-b-only@example.com",
        "both-apps@example.com"
    ];

    const membershipGroupNames = [
        "app-a-users",
        "app-b-users"
    ];

    const membershipUsers = await db
        .select({
            id: users.id,
            email: users.email
        })
        .from(users)
        .where(inArray(users.email, membershipUserEmails));

    const membershipGroups = await db
        .select({
            id: groups.id,
            name: groups.name
        })
        .from(groups)
        .where(inArray(groups.name, membershipGroupNames));

    const userIdByEmail = new Map(
        membershipUsers.map((user) => [
            user.email,
            user.id
        ])
    );

    const groupIdByName = new Map(
        membershipGroups.map((group) => [
            group.name,
            group.id
        ])
    );

    const appAOnlyUserId = userIdByEmail.get(
        "app-a-only@example.com"
    );
    const appBOnlyUserId = userIdByEmail.get(
        "app-b-only@example.com"
    );
    const bothAppsUserId = userIdByEmail.get(
        "both-apps@example.com"
    );

    const appAGroupId = groupIdByName.get("app-a-users");
    const appBGroupId = groupIdByName.get("app-b-users");

    if (
        !appAOnlyUserId ||
        !appBOnlyUserId ||
        !bothAppsUserId ||
        !appAGroupId ||
        !appBGroupId
    ) {
        throw new Error(
            "Required seed users or groups are missing."
        );
    }

    await db
        .insert(userGroups)
        .values([
            {
                userId: appAOnlyUserId,
                groupId: appAGroupId
            },
            {
                userId: appBOnlyUserId,
                groupId: appBGroupId
            },
            {
                userId: bothAppsUserId,
                groupId: appAGroupId
            },
            {
                userId: bothAppsUserId,
                groupId: appBGroupId
            }
        ])
        .onConflictDoNothing({
            target: [
                userGroups.userId,
                userGroups.groupId
            ]
        });
}

async function seedApplications() {
    console.log("Seeding applications...");

    if (env.APP_A_CLIENT_ID === env.APP_B_CLIENT_ID) {
        throw new Error(
            "APP_A_CLIENT_ID and APP_B_CLIENT_ID must be different."
        );
    }

    const seedApplicationData = [
        {
            name: "App A",
            clientId: env.APP_A_CLIENT_ID,
            clientSecret: env.APP_A_CLIENT_SECRET,
            status: "active",
            launchUrl: env.APP_A_LAUNCH_URL,
            logoutNotificationUrl: env.APP_A_LOGOUT_NOTIFICATION_URL
        },
        {
            name: "App B",
            clientId: env.APP_B_CLIENT_ID,
            clientSecret: env.APP_B_CLIENT_SECRET,
            status: "active",
            launchUrl: env.APP_B_LAUNCH_URL,
            logoutNotificationUrl: env.APP_B_LOGOUT_NOTIFICATION_URL
        }
    ];

    const clientIds = seedApplicationData.map(
        (application) => application.clientId
    );

    const existingApplications = await db
        .select({
            clientId: applications.clientId
        })
        .from(applications)
        .where(inArray(applications.clientId, clientIds));

    const existingClientIds = new Set(
        existingApplications.map(
            (application) => application.clientId
        )
    );

    const missingApplications = seedApplicationData.filter(
        (application) =>
            !existingClientIds.has(application.clientId)
    );

    if (missingApplications.length === 0) {
        return;
    }

    const applicationsToInsert = missingApplications.map(
        ({ clientSecret, ...application }) => ({
            ...application,
            clientSecretHash: hashClientSecret(clientSecret)
        })
    );

    await db
        .insert(applications)
        .values(applicationsToInsert)
        .onConflictDoNothing({
            target: applications.clientId
        });
}

async function seedRedirectUris() {
    console.log("Seeding application redirect URIs...");

    const applicationRows = await db
        .select({
            id: applications.id,
            clientId: applications.clientId
        })
        .from(applications)
        .where(
            inArray(
                applications.clientId,
                [
                    env.APP_A_CLIENT_ID,
                    env.APP_B_CLIENT_ID
                ]
            )
        );

    const applicationIdByClientId = new Map(
        applicationRows.map((application) => [
            application.clientId,
            application.id
        ])
    );

    const appAId = applicationIdByClientId.get(
        env.APP_A_CLIENT_ID
    );

    const appBId = applicationIdByClientId.get(
        env.APP_B_CLIENT_ID
    );

    if (!appAId || !appBId) {
        throw new Error(
            "Required seed applications are missing."
        );
    }

    await db
        .insert(applicationRedirectUris)
        .values([
            {
                applicationId: appAId,
                redirectUri: env.APP_A_REDIRECT_URI
            },
            {
                applicationId: appBId,
                redirectUri: env.APP_B_REDIRECT_URI
            }
        ])
        .onConflictDoNothing({
            target: [
                applicationRedirectUris.applicationId,
                applicationRedirectUris.redirectUri
            ]
        });
}

async function seedPolicies() {
    console.log("Seeding application group policies...");

    const applicationRows = await db
        .select({
            id: applications.id,
            clientId: applications.clientId
        })
        .from(applications)
        .where(
            inArray(
                applications.clientId,
                [
                    env.APP_A_CLIENT_ID,
                    env.APP_B_CLIENT_ID
                ]
            )
        );

    const groupRows = await db
        .select({
            id: groups.id,
            name: groups.name
        })
        .from(groups)
        .where(
            inArray(
                groups.name,
                [
                    "app-a-users",
                    "app-b-users"
                ]
            )
        );

    const applicationIdByClientId = new Map(
        applicationRows.map((application) => [
            application.clientId,
            application.id
        ])
    );

    const groupIdByName = new Map(
        groupRows.map((group) => [
            group.name,
            group.id
        ])
    );

    const appAId = applicationIdByClientId.get(
        env.APP_A_CLIENT_ID
    );

    const appBId = applicationIdByClientId.get(
        env.APP_B_CLIENT_ID
    );

    const appAGroupId = groupIdByName.get(
        "app-a-users"
    );

    const appBGroupId = groupIdByName.get(
        "app-b-users"
    );

    if (
        !appAId ||
        !appBId ||
        !appAGroupId ||
        !appBGroupId
    ) {
        throw new Error(
            "Required seed applications or groups are missing."
        );
    }

    await db
        .insert(applicationGroupPolicies)
        .values([
            {
                applicationId: appAId,
                groupId: appAGroupId,
                effect: "allow"
            },
            {
                applicationId: appBId,
                groupId: appBGroupId,
                effect: "allow"
            }
        ])
        .onConflictDoNothing({
            target: [
                applicationGroupPolicies.applicationId,
                applicationGroupPolicies.groupId,
                applicationGroupPolicies.effect
            ]
        });
}

async function seedDatabase() {
    console.log("Seeding database...");

    await seedGroups();
    await seedUsers();
    await seedMemberships();
    await seedApplications();
    await seedRedirectUris();
    await seedPolicies();

    console.log("Database seed completed.");
}

try {
    await seedDatabase();
} finally {
    await closeDatabase();
}