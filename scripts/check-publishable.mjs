/**
 * Checks that every package is FIT to publish.
 *
 * Not that it builds — `verify-build.mjs` checks that — but that it has a name,
 * a version, a licence, a repository URL, a description, and is not marked
 * private.
 *
 * A separate check rather than "we will see at publish time" because the undo
 * window is 72 hours and exists once: publishing without a licence or with the
 * wrong description can be unpublished exactly once in a version's life, and for
 * all the rest of the time the consumer sees what shipped.
 */
import { readFileSync } from "node:fs";
import { PACKAGES, pkgDir, pkgName } from "./registry.mjs";

const REQUIRED_STRINGS = ["name", "version", "description", "license", "homepage"];

const problems = [];

for (const pkg of PACKAGES) {
	const dir = pkgDir(pkg);
	const manifest = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
	const at = (message) => problems.push(`${pkgName(pkg)}: ${message}`);

	if (manifest.private === true) {
		at("marked `private: true` — publishing will silently skip it.");
	}

	for (const field of REQUIRED_STRINGS) {
		const value = manifest[field];
		if (typeof value !== "string" || value.trim().length === 0) {
			at(`missing the \`${field}\` field.`);
		}
	}

	if (typeof manifest.repository?.url !== "string") {
		at("no `repository.url` — npm will show no sources.");
	}
	if (manifest.repository?.directory !== dir) {
		at(`\`repository.directory\` must be "${dir}".`);
	}

	if (!manifest.publishConfig?.exports) {
		at("no `publishConfig.exports` — npm would receive a map pointing at sources.");
	}

	/*
	 * `workspace:` in ANY dependency section is what pnpm substitutes on pack, so
	 * the thing to check is the tarball rather than the manifest —
	 * `verify-build.mjs` does that. What is caught here is the opposite case: a
	 * section pnpm does NOT touch.
	 */
	for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
		if (!String(range).startsWith("workspace:")) continue;
		if (range === "workspace:^") continue;
		at(
			`peer \`${name}\` is declared as \`${String(range)}\`. ` +
				"`workspace:*` becomes an EXACT version and the plugin would demand exactly " +
				"that one — use `workspace:^`.",
		);
	}
}

if (problems.length > 0) {
	console.error("PACKAGES ARE NOT FIT TO PUBLISH\n\n" + problems.join("\n"));
	process.exit(1);
}

console.log(`fit to publish: ${String(PACKAGES.length)}`);
