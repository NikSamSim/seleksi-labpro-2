import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

try {
    await app.listen({
        port: env.AUTH_SERVER_PORT,
        host: "0.0.0.0"
    });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}