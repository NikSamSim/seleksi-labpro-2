import { escapeHtml } from "../../http/html.js";

type AuthenticatedSession = {
    session: {
        id: string;
        externalUserId: string;
        centralSessionId: string;
        status: string;
        createdAt: Date;
        expiresAt: Date;
        lastActivityAt: Date;
    };
    profile: {
        externalUserId: string;
        name: string;
        email: string;
        groups: string[];
        syncedAt: Date;
    };
};

type Activity = {
    id: string;
    eventType: string;
    message: string;
    externalUserId: string | null;
    requestId: string | null;
    createdAt: Date;
};

type ProcessedEvent = {
    eventId: string;
    eventType: string;
    processedAt: Date;
    result: string;
    action: string;
};

function formatDate(value: Date): string {
    return escapeHtml(value.toISOString());
}

function renderGroups(groups: string[]) {
    if (groups.length === 0) {
        return "<li>No groups</li>";
    }

    return groups
        .map(
            (group) =>
                `<li>${escapeHtml(group)}</li>`
        )
        .join("");
}

function renderActivityLogs(
    activities: Activity[]
) {
    if (activities.length === 0) {
        return `
            <p>No activity yet.</p>
        `;
    }

    const rows = activities
        .map(
            (activity) => `
                <tr>
                    <td>${formatDate(activity.createdAt)}</td>
                    <td>${escapeHtml(activity.eventType)}</td>
                    <td>${escapeHtml(activity.message)}</td>
                    <td>${escapeHtml(activity.requestId ?? "-")}</td>
                </tr>
            `
        )
        .join("");

    return `
        <table border="1" cellpadding="6">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Message</th>
                    <th>Request ID</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function renderProcessedEvents(
    events: ProcessedEvent[]
) {
    if (events.length === 0) {
        return `
            <p>No processed events yet.</p>
        `;
    }

    const rows = events
        .map(
            (event) => `
                <tr>
                    <td>${formatDate(event.processedAt)}</td>
                    <td>${escapeHtml(event.eventId)}</td>
                    <td>${escapeHtml(event.eventType)}</td>
                    <td>${escapeHtml(event.result)}</td>
                    <td>${escapeHtml(event.action)}</td>
                </tr>
            `
        )
        .join("");

    return `
        <table border="1" cellpadding="6">
            <thead>
                <tr>
                    <th>Processed At</th>
                    <th>Event ID</th>
                    <th>Event Type</th>
                    <th>Result</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

export function renderUnauthenticatedHome(
    applicationName: string
) {
    return `<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <title>${escapeHtml(applicationName)}</title>
</head>
<body>
    <main>
        <h1>${escapeHtml(applicationName)}</h1>

        <section>
            <h2>Local Session</h2>
            <p>Status: <strong>Not authenticated</strong></p>
        </section>

        <p>
            <a href="/login">Login</a>
        </p>
    </main>
</body>
</html>`;
}

export function renderAuthenticatedHome(input: {
    applicationName: string;
    authenticatedSession: AuthenticatedSession;
    activities: Activity[];
    processedEvents: ProcessedEvent[];
}) {
    const {
        session,
        profile
    } = input.authenticatedSession;

    return `<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <title>${escapeHtml(input.applicationName)}</title>
</head>
<body>
    <main>
        <h1>${escapeHtml(input.applicationName)}</h1>

        <section>
            <h2>Identity</h2>

            <p>
                Hello,
                <strong>${escapeHtml(profile.name)}</strong>
            </p>

            <p>
                Email:
                ${escapeHtml(profile.email)}
            </p>

            <p>Groups:</p>

            <ul>
                ${renderGroups(profile.groups)}
            </ul>
        </section>

        <section>
            <h2>Local Session</h2>

            <p>
                Status:
                <strong>${escapeHtml(session.status)}</strong>
            </p>

            <p>
                Created:
                ${formatDate(session.createdAt)}
            </p>

            <p>
                Expires:
                ${formatDate(session.expiresAt)}
            </p>

            <p>
                Last activity:
                ${formatDate(session.lastActivityAt)}
            </p>

            <form method="post" action="/logout">
                <button type="submit">
                    Logout
                </button>
            </form>
        </section>

        <section>
            <h2>Activity Log</h2>

            ${renderActivityLogs(input.activities)}
        </section>

        <section>
            <h2>Processed Events</h2>

            ${renderProcessedEvents(input.processedEvents)}
        </section>
    </main>
</body>
</html>`;
}