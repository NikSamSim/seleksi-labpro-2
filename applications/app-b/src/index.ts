import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/client.js";

const app = buildApp();

let shuttingDown = false;

try {
    app.log.info(
        { port: env.APP_B_PORT },
        "Starting App B"
    );

    await app.listen({
        port: env.APP_B_PORT,
        host: "0.0.0.0"
    });

    app.log.info("App B started successfully");
} catch {
    app.log.error("Failed to start App B");
    process.exit(1);
}

async function shutdown(signal: "SIGTERM" | "SIGINT") {
    if (shuttingDown) return;

    shuttingDown = true;

    app.log.info({ signal }, "Shutting down App B");

    try {
        await app.close();
        await closeDatabase();

        app.log.info("App B shutdown complete");
    }
    catch (error) {
        app.log.error({ err: error }, "App B shutdown failed");
        process.exitCode = 1;
    }
}

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});