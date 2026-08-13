import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabase, closeDatabase } from "./db/client.js";
import { connectRabbitMQ, disconnectRabbitMQ } from "./messaging/rabbitmq.js";

const app = buildApp();

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

async function shutdown() {
    app.log.info("Shutting down event publisher");

    await app.close();

    await Promise.allSettled([
        disconnectRabbitMQ(),
        closeDatabase()
    ]);

    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);