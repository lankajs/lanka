import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { lankaDiVite } from "../../../tools/di/src/lanka-di-vite/lankaDiVite";

/**
 * The application's build.
 *
 * `lankaDiVite` is not optional: the framework imports `@lanka_di/Gateways` and
 * its four siblings, and a build without the plugin fails on the first of them.
 * `scaffold` writes the barrels when they are missing, which is what a developer
 * wants and what CI must not do silently — hence the flag.
 */
export default defineConfig({
	plugins: [svelte(), lankaDiVite({ scaffold: !process.env.CI })],
	server: { port: 4394 },
});
