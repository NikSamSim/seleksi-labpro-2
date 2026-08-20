import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/client.js";
import { disconnectRabbitMQ } from "./messaging/rabbitmq.js";

let shuttingDown = false;

const app = buildApp(() => shuttingDown);

function startShutdownDeadline() {
    return setTimeout(() => {
        app.log.error(
            {
                timeoutMs: env.SHUTDOWN_TIMEOUT_MS
            },
            "Auth server graceful shutdown timed out; forcing exit"
        );

        process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
}

try {
    app.log.info(
        { port: env.AUTH_SERVER_PORT },
        "Starting auth server"
    );

    await app.listen({
        port: env.AUTH_SERVER_PORT,
        host: "0.0.0.0"
    });

    app.log.info("Auth server started successfully");
} catch (error) {
    app.log.error("Failed to start auth server");
    process.exit(1);
}

async function shutdown(signal: "SIGTERM" | "SIGINT") {
    if (shuttingDown) return;

    shuttingDown = true;

    const shutdownDeadline = startShutdownDeadline();

    app.log.info(
        {
            signal,
            timeoutMs: env.SHUTDOWN_TIMEOUT_MS
        },
        "Shutting down auth server"
    );

    try {
        await app.close();

        const results = await Promise.allSettled([
            disconnectRabbitMQ(),
            closeDatabase()
        ]);

        if (results.some((result) => result.status === "rejected")) {
            throw new Error("Failed to close one or more dependencies");
        }

        clearTimeout(shutdownDeadline);

        app.log.info("Auth server shutdown complete");
    }
    catch (error) {
        app.log.error({ err: error }, "Auth server shutdown failed");
        process.exitCode = 1;
    }
}

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});