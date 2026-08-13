import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { connectRabbitMQ, disconnectRabbitMQ } from "./messaging/rabbitmq.js";

const app = buildApp();

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

async function shutdown() {
    app.log.info("Shutting down sync worker");

    await app.close();
    await disconnectRabbitMQ();

    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);