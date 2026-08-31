import { defineConfig } from "tsup";

/**
 * Package build: ESM plus `.d.ts`, one file per entry in `exports`.
 *
 * Built by a BUNDLER rather than `tsc` for one reason: `tsc` emits relative
 * specifiers as written — without extensions — and node in ESM mode cannot
 * resolve them. The choice was between rewriting every import in the sources
 * and a bundler that does it.
 *
 * `splitting` is on: there are many entries, and without it shared code would
 * be copied into each, so a consumer taking two subsystems would pay for the
 * core twice.
 *
 * GENERATED from `scripts/registry.mjs`. Edit the registry.
 */
export default defineConfig({
	entry: [
		"src/index.ts",
	],
	format: ["esm"],
	dts: true,
	splitting: true,
	clean: true,
	sourcemap: true,
	target: "es2022",
});
