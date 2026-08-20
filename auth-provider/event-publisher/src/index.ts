import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabase, closeDatabase } from "./db/client.js";
import {
    connectRabbitMQ,
    disconnectRabbitMQ,
    setupRabbitMQTopology
} from "./messaging/rabbitmq.js";
import {
    startPublisherLoop,
    stopPublisherLoop
} from "./publisher/service.js";

let shuttingDown = false;

const app = buildApp(() => shuttingDown);

function startShutdownDeadline() {
    return setTimeout(() => {
        app.log.error(
            {
                timeoutMs:
                    env.SHUTDOWN_TIMEOUT_MS
            },
            "Event publisher graceful shutdown timed out; forcing exit"
        );

        process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
}

try {
    app.log.info(
        { port: env.EVENT_PUBLISHER_PORT },
        "Starting event publisher"
    );

    try {
        await checkDatabase();
        app.log.info("Event publisher connected to primary database");
    } catch {
        app.log.error("Event publisher failed to connect to primary database");
        throw new Error("Primary database connection failed");
    }

    try {
        await connectRabbitMQ();
        await setupRabbitMQTopology();

        app.log.info("Event publisher connected to RabbitMQ");
        app.log.info("Event publisher RabbitMQ topology ready");
    } catch {
        app.log.error("Event publisher failed to connect to RabbitMQ");
        throw new Error("RabbitMQ connection failed");
    }

    await app.listen({
        port: env.EVENT_PUBLISHER_PORT,
        host: "0.0.0.0"
    });

    startPublisherLoop(app.log);

    app.log.info(
        "Event publisher polling loop started"
    );

    app.log.info("Event publisher started successfully");
} catch {
    app.log.error("Failed to start event publisher");
    process.exit(1);
}

async function shutdown(signal: "SIGTERM" | "SIGINT") {
    if (shuttingDown) return;

    shuttingDown = true;

    const shutdownDeadline =
        startShutdownDeadline();

    app.log.info(
        {
            signal,
            timeoutMs:
                env.SHUTDOWN_TIMEOUT_MS
        },
        "Shutting down event publisher"
    );

    try {
        await app.close();

        await stopPublisherLoop();

        const results = await Promise.allSettled([
            disconnectRabbitMQ(),
            closeDatabase()
        ]);

        if (results.some((result) => result.status === "rejected")) {
            throw new Error("Failed to close one or more dependencies");
        }

        clearTimeout(shutdownDeadline);

        app.log.info("Event publisher shutdown complete");
    }
    catch (error) {
        app.log.error({ err: error }, "Event publisher shutdown failed");
        process.exitCode = 1;
    }
}

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});