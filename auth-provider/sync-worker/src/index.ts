import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import {
    connectRabbitMQ,
    disconnectRabbitMQ,
    setupRabbitMQTopology
} from "./messaging/rabbitmq.js";
import {
    checkDatabase,
    closeDatabase
} from "./db/client.js";

import {
    getInFlightDeliveryCount,
    startConsumerRecoveryLoop,
    stopConsumerRecoveryLoop
} from "./worker/consumer.js";

let shuttingDown = false;

const app = buildApp(() => shuttingDown);

function startShutdownDeadline() {
    return setTimeout(() => {
        app.log.error(
            {
                timeoutMs:
                    env.SHUTDOWN_TIMEOUT_MS,
                inFlightDeliveries:
                    getInFlightDeliveryCount()
            },
            "Sync worker graceful shutdown timed out; forcing exit"
        );

        process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
}

try {
    app.log.info(
        { port: env.SYNC_WORKER_PORT },
        "Starting sync worker"
    );

    try {
        await checkDatabase();

        app.log.info(
            "Sync worker connected to primary database"
        );
    } catch {
        app.log.error(
            "Sync worker failed to connect to primary database"
        );

        throw new Error(
            "Primary database connection failed"
        );
    }

    try {
        await connectRabbitMQ();
        await setupRabbitMQTopology();

        app.log.info("Sync worker connected to RabbitMQ");
        app.log.info("Sync worker RabbitMQ topology ready");
    } catch {
        app.log.error("Sync worker failed to connect to RabbitMQ");
        throw new Error("RabbitMQ connection failed");
    }

    startConsumerRecoveryLoop(app.log);

    app.log.info(
        "Sync worker consumer recovery loop started"
    );

    await app.listen({
        port: env.SYNC_WORKER_PORT,
        host: "0.0.0.0"
    });

    app.log.info("Sync worker started successfully");
} catch {
    app.log.error("Failed to start sync worker");
    process.exit(1);
}

async function shutdown(signal: "SIGTERM" | "SIGINT") {
    if (shuttingDown) return;

    shuttingDown = true;

    const shutdownDeadline = startShutdownDeadline();

    app.log.info(
        {
            signal,
            timeoutMs:
                env.SHUTDOWN_TIMEOUT_MS
        },
        "Shutting down sync worker"
    );

    try {
        await stopConsumerRecoveryLoop();

        await app.close();

        const results = await Promise.allSettled([
            disconnectRabbitMQ(),
            closeDatabase()
        ]);

        for (const result of results) {
            if (result.status === "rejected") {
                app.log.error(
                    { err: result.reason },
                    "Sync worker dependency shutdown failed"
                );

                process.exitCode = 1;
            }
        }
        clearTimeout(shutdownDeadline);
        app.log.info("Sync worker shutdown complete");
    }
    catch (error) {
        app.log.error({ err: error }, "Sync worker shutdown failed");
        process.exitCode = 1;
    }
}

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});