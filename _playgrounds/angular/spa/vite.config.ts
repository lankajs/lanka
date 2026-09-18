import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vite";
import { lankaDiVite } from "../../../tools/di/src/lanka-di-vite/lankaDiVite";

/**
 * The application's build.
 *
 * Vite and not the Angular CLI, and that is the point rather than a shortcut:
 * `lankaDiVite` is a Vite plugin, and an application built by the CLI's own
 * pipeline would need a different one. Showing the framework under Vite is
 * showing it under the build a consumer picking Angular in 2026 most likely has.
 *
 * `lankaDiVite` is not optional: the framework imports `@lanka_di/Gateways` and
 * its four siblings, and a build without the plugin fails on the first of them.
 */
export default defineConfig({
	plugins: [angular(), lankaDiVite({ scaffold: !process.env.CI })],
	server: { port: 4399 },
});
