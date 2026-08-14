import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { connectRabbitMQ, disconnectRabbitMQ } from "./messaging/rabbitmq.js";

let shuttingDown = false;

const app = buildApp(() => shuttingDown);

try {
    await connectRabbitMQ();

    await app.listen({
        port: env.SYNC_WORKER_PORT,
        host: "0.0.0.0"
    });
} catch (error) {
    app.log.error(error);
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

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);