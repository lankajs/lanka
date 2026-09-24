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
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { PACKAGES, pkgDir, pkgName } from "./registry.mjs";

/** A path's mode as the git index records it — `100755` is executable. */
const committedMode = (path) =>
	execFileSync("git", ["ls-files", "-s", "--", path], { encoding: "utf8" }).split(" ")[0];

/** Every file a manifest names as a command, whichever form `bin` takes. */
const binTargets = (manifest) =>
	Object.values(
		typeof manifest.bin === "string" ? { [manifest.name]: manifest.bin } : (manifest.bin ?? {}),
	);

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

	/*
	 * A command is committed EXECUTABLE. pnpm sets the bit on a workspace bin it
	 * links, which on Linux changes the file's mode: CI's tree was dirty before
	 * its first gate ran, and `check:drift` — which starts by refusing a dirty
	 * tree — failed on every push from 2026-09-06, while Windows, where git
	 * ignores the mode, saw nothing. The index records the mode on every OS.
	 */
	for (const target of binTargets(manifest)) {
		const path = posix.join(dir, target);
		if (committedMode(path) !== "100755") {
			at(
				`bin \`${target}\` is committed without the executable bit; ` +
					`\`pnpm install\` sets it on Linux and CI starts from a dirty tree. ` +
					`Run \`git update-index --chmod=+x ${path}\`.`,
			);
		}
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
