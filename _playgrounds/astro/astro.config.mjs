import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
/*
 * From BUILT OUTPUT, by path, and only inside this repository.
 *
 * A consumer writes `@lankajs/tool-di/vite`. Here the workspace link points at
 * TypeScript SOURCE and this file is loaded by node, which will not compile it.
 * `pnpm build` before `astro dev` — `playgrounds/README.md` says so out loud.
 */
import { lankaDiVite } from "../../tools/di/dist/vite.js";

/**
 * Astro takes vite plugins through `vite: { plugins }`, and that is the whole
 * integration.
 *
 * The same `lankaDiVite` the single-page application uses, under a different
 * host, which is the point of this fourth application existing at all: the seam
 * is a seam rather than a Next adapter.
 *
 * `output: "server"` because the page below renders per request. Astro's default
 * is static, and a page that reads `Astro.request.headers` under it would be
 * reading headers nobody sent.
 */
export default defineConfig({
	output: "server",
	adapter: node({ mode: "standalone" }),
	integrations: [react()],
	server: { port: 4393 },
	vite: {
		plugins: [lankaDiVite({ scaffold: !process.env.CI })],
		// The framework and the application are resolved from SOURCE here, and
		// vite's optimiser would pre-bundle them as if they were published — which
		// is a second copy, with its own module registry and its own ambient
		// instance.
		ssr: { noExternal: ["lanka", "@lanka-playgrounds/_shared"] },
	},
});
