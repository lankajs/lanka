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
 * `@lanka_di/*` is EXTERNAL, and that line is the whole reason a published
 * package can be wired to anything. Those specifiers are the consumer's
 * barrels; this repository resolves them to `tools/testing/_fixtures/.lanka_di/`
 * so its own suite has something to read. Bundled, that fixture SHIPS — and it
 * is empty, so an installed `lanka` resolves every gateway, scenario and
 * singleton against `{}` and throws `not found` for all of them, while the
 * consumer's `@lanka_di` alias has nothing left to attach to. Left external,
 * the import survives into `dist` and into the `.d.ts`, and the consumer's
 * bundler alias and `tsconfig` paths answer it — which is what the inversion
 * was for. Declared for every package, not just `core`: a specifier nothing
 * imports costs nothing to externalise, and a per-package list is a second
 * list to keep in step.
 *
 * GENERATED from `scripts/registry.mjs`. Edit the registry.
 */
export default defineConfig({
	entry: [
		"src/index.ts",
		"src/setupTests.ts",
		"src/lankaTestHost.ts",
		"src/vitest.ts",
		"src/resetLanka.ts",
		"src/lankaBenchCalibration.ts",
		"src/lanka-validator-conformance/lankaValidatorConformance.ts",
		"src/lanka-read-cache-conformance/lankaReadCacheConformance.ts",
		"src/lanka-storage-adapter-conformance/lankaStorageAdapterConformance.ts",
	],
	format: ["esm"],
	dts: true,
	splitting: true,
	clean: true,
	sourcemap: true,
	target: "es2022",
	external: [/^@lanka_di\//],
});
