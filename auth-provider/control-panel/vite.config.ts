import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, resolve(process.cwd(), "../.."), "");

    return {
        plugins: [react()],
        server: {
            host: "0.0.0.0",
            port: Number(env.CONTROL_PANEL_PORT ?? 3001),
            strictPort: true
        },
        preview: {
            host: "0.0.0.0",
            port: Number(env.CONTROL_PANEL_PORT ?? 3001),
            strictPort: true
        }
    };
});