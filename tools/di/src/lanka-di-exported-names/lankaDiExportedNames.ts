import { withoutCommentedLines } from "../_utils/without-commented-lines/withoutCommentedLines";

/**
 * Every name a barrel exports under its own name.
 *
 * ## What it is for
 *
 * A barrel sharded across both directories is joined by `export *`, and ESM
 * resolves an ambiguous star export by DROPPING the name — no error at build, no
 * error at type-check, and a gateway that is simply not in the locator. That is
 * the one failure sharding adds, and it is invisible unless something reads both
 * sides and compares. This is that read.
 *
 * ## Why a regex and not the TypeScript compiler
 *
 * The same reason the rest of this package is a regex: it runs inside a config
 * file, before a build, in a process that may have no TypeScript at all —
 * `lankaDiMetro` is called from `metro.config.js`. A barrel is also the most
 * constrained file in a consumer's repository: a doc comment and a list of
 * export lines, written by a stub this package supplies.
 *
 * It answers about the forms a barrel is written in, and says so by what it
 * MISSES rather than by guessing. `export * from` contributes names that cannot
 * be known from this file, and a re-export of a whole module is exactly the
 * bridge — so a name arriving through one is out of scope here, and the caller
 * compares the two sides' OWN names.
 *
 * `export type` is included. A type collision across shards is dropped the same
 * way and shows up as "that type is not exported", which reads as a missing
 * export rather than as a duplicate one.
 */
export const lankaDiExportedNames = (source: string): readonly string[] => {
	const live = withoutCommentedLines(source);

	return [...listed(live), ...declared(live)];
};

/**
 * `export { A, B as C }`, with or without a `from`.
 *
 * The name that COUNTS is the one after `as`, because that is what an importer
 * writes and therefore what collides. A list is split on commas rather than
 * matched as a whole, so a line holding six names reports six.
 */
const listed = (source: string): string[] =>
	[...source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)].flatMap((match) =>
		match[1]
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
			// `split` on a non-empty string always yields at least one part, so the
			// last one is a string and there is no absent case to guard. A `??` here
			// would be a branch no input can take, which is a line of defence that
			// only ever reports success.
			.map((entry) =>
				entry
					.split(/\s+as\s+/)
					.slice(-1)
					.join("")
					.replace(/^type\s+/, "")
					.trim(),
			)
			.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name)),
	);

/** `export const A`, and every other keyword a name can be declared behind. */
const declared = (source: string): string[] =>
	[
		...source.matchAll(
			/export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
		),
	].map((match) => match[1]);
