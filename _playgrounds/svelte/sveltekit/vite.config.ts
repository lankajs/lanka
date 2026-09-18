import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { lankaDiVite } from "../../../tools/di/src/lanka-di-vite/lankaDiVite";

/**
 * The application's build.
 *
 * `lankaDiVite` sits BESIDE Kit's plugin rather than replacing anything in it:
 * the framework imports `@lanka_di/Gateways` and its four siblings on both
 * sides of this application, and a server build without the plugin fails on the
 * first of them exactly as a browser build does.
 */
export default defineConfig({
	plugins: [sveltekit(), lankaDiVite({ scaffold: !process.env.CI })],
});
