import { defineConfig } from "vite";
/*
 * Imported by RELATIVE PATH, and only inside this repository.
 *
 * A consumer writes `@lankajs/tool-di/vite`. Here the workspace link points at
 * TypeScript SOURCE, and a config file is loaded by node rather than by the
 * bundler it configures — so node applies its own ESM resolution, which needs a
 * file extension on every relative import and does not find one.
 */
import { lankaDiVite } from "../../tools/di/src/lanka-di-vite/lankaDiVite";

/**
 * The build — and the shortest one in this repository.
 *
 * One plugin, and it is the framework's own. There is no UI framework here to
 * configure, which is the whole point of this application: what a consumer needs
 * to build lanka is `lankaDiVite` and nothing else, and every other playground's
 * config is that plus their framework's.
 */
export default defineConfig({
	plugins: [lankaDiVite({ scaffold: !process.env.CI })],
	server: { port: 4395 },
});
