import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { ILankaSkillHost } from "../../_interfaces/ILankaSkillHost";

/**
 * The port over a real file system.
 *
 * The only part of this package that cannot be tested without a disk, and it is
 * deliberately the smallest: every decision lives above it, in code that takes
 * the port as a parameter.
 */
/**
 * The directory a resolved entry file belongs to.
 *
 * Resolution answers a FILE — `…/dist/index.js` — and what is wanted is the
 * package it came from, so the walk goes up until a `package.json` appears. It
 * stops at the filesystem root rather than counting levels: a package's entry can
 * be one directory deep or four, and a fixed number would be right for whichever
 * layout it was written against.
 */
const packageDirOf = (entry: string): string | null => {
	let dir = dirname(entry);

	for (;;) {
		if (existsSync(join(dir, "package.json"))) return dir.replace(/\\/g, "/");

		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
};

export const lankaNodeSkillHost: ILankaSkillHost = Object.freeze<ILankaSkillHost>({
	resolvePackageDir: (packageName, from) => {
		try {
			// Resolved FROM the consumer's own manifest, so the answer is what their
			// project would import — hoisted to a workspace root, linked by pnpm, or
			// inside Yarn's Plug'n'Play, where no path would have been guessable.
			const requireFrom = createRequire(join(from, "package.json"));
			return packageDirOf(requireFrom.resolve(packageName));
		} catch {
			// A package can be declared and not installed, and one can also refuse to
			// resolve its own entry from here. Falling back to the ordinary layout
			// keeps the common case working when the clever one does not.
			const conventional = join(from, "node_modules", packageName);
			return existsSync(conventional) ? conventional.replace(/\\/g, "/") : null;
		}
	},

	readJsonFile: (path) => {
		try {
			return JSON.parse(readFileSync(path, "utf8")) as unknown;
		} catch {
			// A missing or unreadable manifest is not an error here: it means "no
			// skills from this package", which the caller already handles.
			return null;
		}
	},

	listDirectories: (path) => {
		try {
			return readdirSync(path, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
				.sort();
		} catch {
			return [];
		}
	},

	exists: (path) => existsSync(path),

	copyDirectory: (from, to) => {
		// Removed first: a copy over a previous version leaves files the new one no
		// longer has, and a stale `reference.md` beside a current skill is the kind
		// of wrong that reads as correct.
		rmSync(to, { recursive: true, force: true });
		mkdirSync(dirname(to), { recursive: true });
		cpSync(from, to, { recursive: true });
	},

	writeTextFile: (path, text) => {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text, "utf8");
	},
});
