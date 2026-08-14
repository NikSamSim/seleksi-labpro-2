import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabase, closeDatabase } from "./db/client.js";
import { connectRabbitMQ, disconnectRabbitMQ } from "./messaging/rabbitmq.js";

let shuttingDown = false;

const app = buildApp(() => shuttingDown);

try {
    await checkDatabase();
    await connectRabbitMQ();

    await app.listen({
        port: env.EVENT_PUBLISHER_PORT,
        host: "0.0.0.0"
    });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}

async function shutdown(signal: "SIGTERM" | "SIGINT") {
    if (shuttingDown) return;

    shuttingDown = true;

    app.log.info({ signal }, "Shutting down event publisher");

    try {
        await app.close();

        const results = await Promise.allSettled([
            disconnectRabbitMQ(),
            closeDatabase()
        ]);

        if (results.some((result) => result.status === "rejected")) {
            throw new Error("Failed to close one or more dependencies");
        }

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

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);