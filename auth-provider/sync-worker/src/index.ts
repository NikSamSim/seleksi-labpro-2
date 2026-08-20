import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import {
    connectRabbitMQ,
    disconnectRabbitMQ,
    setupRabbitMQTopology
} from "./messaging/rabbitmq.js";

let shuttingDown = false;

const app = buildApp(() => shuttingDown);

try {
    app.log.info(
        { port: env.SYNC_WORKER_PORT },
        "Starting sync worker"
    );

    try {
        await connectRabbitMQ();
        await setupRabbitMQTopology();

        app.log.info("Sync worker connected to RabbitMQ");
        app.log.info("Sync worker RabbitMQ topology ready");
    } catch {
        app.log.error("Sync worker failed to connect to RabbitMQ");
        throw new Error("RabbitMQ connection failed");
    }

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

    app.log.info({ signal }, "Shutting down sync worker");

    try {
        await app.close();
        await disconnectRabbitMQ();

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