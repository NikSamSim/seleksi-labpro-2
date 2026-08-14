import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/client.js";

const app = buildApp();

let shuttingDown = false;

try {
    await app.listen({
        port: env.APP_A_PORT,
        host: "0.0.0.0"
    });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}

async function shutdown(signal: "SIGTERM" | "SIGINT") {
    if (shuttingDown) return;

    shuttingDown = true;

    app.log.info({ signal }, "Shutting down App A");

    try {
        await app.close();
        await closeDatabase();

        app.log.info("App A shutdown complete");
    }
    catch (error) {
        app.log.error({ err: error }, "App A shutdown failed");
        process.exitCode = 1;
    }
}

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});