/**
 * Which relative links in a package's SHIPPED markdown the tarball cannot answer.
 *
 * On GitHub `./GUIDE.md` resolves; in a consumer's `node_modules` only what
 * `files` names exists. Every package README linked a guide, a maintenance skill
 * and the repository map, none of which ship — dead for anyone reading the
 * installed package (issue #9). `check-docs` cannot see this: it reads the
 * repository, where every one of those links lands.
 *
 * Read from the file system rather than from `npm pack`: packing forty packages
 * is the build check's job and takes minutes, and what a link can reach is
 * decided by `files` and by what is on disk, both of which are right here.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix } from "node:path";

/** What npm packs whatever `files` says. */
const ALWAYS_PACKED = ["package.json", "README.md", "LICENSE"];

/**
 * Not walked for markdown: built output carries none, and walking it costs a
 * read of every chunk of forty packages.
 */
const NOT_WALKED = new Set(["dist", "node_modules"]);

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** Every link target in a markdown text — inline links and images alike. */
export const linkTargets = (markdown) =>
	[...markdown.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1]);

/** A target that leaves the file system: a URL with a scheme, or a page anchor. */
const isExternal = (target) => /^[a-z][a-z\d+\-.]*:/i.test(target) || target.startsWith("#");

/** Every markdown file the tarball carries, relative to the package, `/`-separated. */
export const shippedMarkdown = (pkgRoot, files) => {
	const found = existsSync(join(pkgRoot, "README.md")) ? ["README.md"] : [];

	const walk = (relative) => {
		const absolute = join(pkgRoot, relative);
		if (!existsSync(absolute)) return;
		if (statSync(absolute).isFile()) {
			if (relative.endsWith(".md") && relative !== "README.md") found.push(relative);
			return;
		}
		for (const entry of readdirSync(absolute)) {
			if (!NOT_WALKED.has(entry)) walk(posix.join(relative, entry));
		}
	};
	for (const entry of files) {
		if (!NOT_WALKED.has(posix.normalize(entry).replace(/\/$/, ""))) walk(entry);
	}

	return found;
};

/**
 * Every relative link in the shipped markdown of one package that lands on
 * nothing inside its tarball, as `file: target`.
 *
 * A target is resolved against the file holding it. It lands when it stays
 * inside the package, falls under an entry of `files` (or one npm always
 * packs), and is a FILE. A directory is not a landing: no reader of an
 * installed package opens one from a link, and `../` copied two levels down
 * into a skill's `reference.md` lands on the package's own `skills/` — present,
 * and not what the text names. A link climbing out of the package is dead whatever
 * exists above it: above it, in `node_modules`, is somebody else's package.
 */
export const deadTarballLinks = (pkgRoot, files) => {
	const shipped = [...ALWAYS_PACKED, ...files].map((entry) =>
		posix.normalize(entry).replace(/\/$/, ""),
	);
	const packs = (path) => shipped.some((entry) => path === entry || path.startsWith(`${entry}/`));
	const dead = [];

	for (const file of shippedMarkdown(pkgRoot, files)) {
		const from = posix.dirname(file);

		for (const target of linkTargets(readFileSync(join(pkgRoot, file), "utf8"))) {
			if (isExternal(target)) continue;

			const path = posix.normalize(posix.join(from, target.split("#")[0])).replace(/\/$/, "");
			const inside = path !== ".." && !path.startsWith("../") && !posix.isAbsolute(target);
			const lands = inside && packs(path) && isFile(join(pkgRoot, path));
			if (!lands) dead.push(`${file}: ${target}`);
		}
	}

	return dead;
};
