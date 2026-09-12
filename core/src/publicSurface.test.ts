import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What the framework promises to the outside.
 *
 * A test rather than a convention: an `exports` map of `"./*": "./src/*.ts"`
 * makes EVERYTHING public, internal registries included, and an underscore in a
 * name is a convention rather than a barrier.
 *
 * Three checks, each closing its own way of being wrong:
 *
 * 1. **The map is exactly what is expected.** Equal, not "contains": an extra
 *    key is a promise made by accident, and removing it later takes a major.
 * 2. **Every key leads to an existing barrel.** A key pointing nowhere breaks
 *    neither the build nor the lint — it breaks a consumer's `import`.
 * 3. **Every subsystem in the tree is in the map.** Otherwise a new subsystem
 *    appears as a folder and stays silently unreachable from outside; the first
 *    person who needs it notices, as a missing feature.
 *
 * The map is the facade plus the two TIERS of `skills/surface/SKILL.md`. A tier
 * is reachable and promises less, and which one a reader is looking at is
 * written in the import path: `lanka/gateway` is promised until a major,
 * `lanka/extend` may move in a minor, `lanka/internal` in any release.
 *
 * So the fourth check has a fourth answer: a folder under `src/` is a subsystem,
 * a tier's bucket, or unreachable. What is forbidden is the state this file used
 * to describe — a barrel promising that `_internal` may be refactored without a
 * major while re-exporting three things out of it.
 */

const PACKAGE_ROOT = join(__dirname, "..");
const SRC = __dirname;

/** Core subsystems, in the order used by the README and `scripts/registry.mjs`. */
const SUBSYSTEMS = [
	"bootstrap",
	"role",
	"config",
	"locator",
	"gateway",
	"validation",
	"cache",
	"mock",
	"errors",
	"scenario",
	"stream",
	"viewmodel",
	"logger",
] as const;

/**
 * Tiers, by the subpath a consumer types and the bucket that answers it.
 *
 * The bucket carries the structure marker and the subpath does not: one is where
 * a file sits, the other is what is promised about it, and neither has to move
 * for the other.
 */
const TIERS = [
	{ subpath: "extend", bucket: "_extend" },
	{ subpath: "internal", bucket: "_internal" },
] as const;

/** Folders under `src/` that are neither a subsystem nor a tier's bucket. */
const NOT_EXPORTED: string[] = [];

type TManifest = { exports: Record<string, string> };

const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as TManifest;

describe("the public surface", () => {
	it("the exports map is the root, every subsystem and two tiers", () => {
		const expected = [
			".",
			...SUBSYSTEMS.map((s) => `./${s}`),
			...TIERS.map((t) => `./${t.subpath}`),
		].sort();

		// Equal, not "contains": an extra key is a promise made by accident.
		expect(Object.keys(manifest.exports).sort()).toEqual(expected);
	});

	it("every key points at a file that exists", () => {
		for (const [key, target] of Object.entries(manifest.exports)) {
			expect(target.startsWith("./src/"), `${key} → ${target}`).toBe(true);
			expect(existsSync(join(PACKAGE_ROOT, target)), `${key} → ${target}`).toBe(true);
		}
	});

	it("every subsystem is exported through a barrel, not a file inside it", () => {
		for (const subsystem of SUBSYSTEMS) {
			expect(manifest.exports[`./${subsystem}`]).toBe(`./src/${subsystem}/index.ts`);
		}
	});

	it("every tier points at the bucket that answers it", () => {
		for (const tier of TIERS) {
			expect(manifest.exports[`./${tier.subpath}`]).toBe(`./src/${tier.bucket}/index.ts`);
		}
	});

	it("every folder under src/ is a subsystem, a tier's bucket, or declared unreachable", () => {
		const folders = readdirSync(SRC).filter((entry) =>
			statSync(join(SRC, entry)).isDirectory(),
		);
		const buckets = TIERS.map((t) => t.bucket as string);
		const unaccounted = folders.filter(
			(f) =>
				!SUBSYSTEMS.includes(f as (typeof SUBSYSTEMS)[number]) &&
				!buckets.includes(f) &&
				!NOT_EXPORTED.includes(f),
		);

		// Otherwise a new subsystem appears as a folder and stays silently
		// unreachable; the first person who needs it notices, as a missing feature.
		expect(unaccounted).toEqual([]);
	});

	it("a bucket is never reachable by its own name", () => {
		// `lanka/_internal` would be a second door to the same room, and only one of
		// the two would carry the word that tells a reader what they are touching.
		const leaking = Object.keys(manifest.exports).filter((key) => key.startsWith("./_"));
		expect(leaking).toEqual([]);
	});

	it("the facade promises no primitive of the internal tier", () => {
		const facade = readFileSync(join(SRC, "index.ts"), "utf8");

		// The contradiction this file used to allow: a barrel saying the internal
		// bucket may be refactored freely, and exporting out of it in the same
		// breath.
		expect(facade).not.toMatch(/^export .* from "\.\/_internal\//m);
	});
});
