import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
/*
 * Imported by RELATIVE PATH, and only inside this repository.
 *
 * A consumer writes `@lankajs/tool-di/vite`. Here the workspace link points at
 * TypeScript SOURCE, and a config file is loaded by node rather than by the
 * bundler it configures — so node applies its own ESM resolution, which needs a
 * file extension on every relative import and does not find one. The path below
 * is the same module, reached the way this repository can reach it.
 */
import { lankaDiVite } from "../../tools/di/src/lanka-di-vite/lankaDiVite";

/**
 * The build.
 *
 * `lankaDiVite` is not optional: the framework imports `@lanka_di/Gateways` and
 * three siblings at module level, so without the alias nothing resolves at all.
 * Getting it wrong is not a lint note — it is "module not found" at start-up.
 *
 * `scaffold: !process.env.CI` because a build that quietly repairs itself hides
 * a `.lanka_di/` nobody committed until the project is built on another machine.
 */
export default defineConfig({
	plugins: [react(), lankaDiVite({ scaffold: !process.env.CI })],
	server: { port: 4390 },
	/*
	 * The framework is consumed from SOURCE inside this repository: a workspace
	 * link points at `src/index.ts`, not at a build. Vite's dependency optimiser
	 * would try to pre-bundle those as if they were published packages, and a
	 * pre-bundled copy is a second copy — two module registries, two ambient
	 * instances, and a locator that resolves in one of them.
	 */
	optimizeDeps: { exclude: ["lanka", "@lanka-playgrounds/_shared"] },
});
