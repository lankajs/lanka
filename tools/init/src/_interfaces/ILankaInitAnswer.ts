import type { TLankaInitRuntime } from "../_types/TLankaInitRuntime";

/**
 * One answer to one question, and everything taking it costs.
 *
 * Every axis this command asks about — the validator, the transport, the storage
 * engine, each extra — is a list of these, so a new answer is an ENTRY rather
 * than a branch inside a function. That is `skills/composition/SKILL.md` §2 and
 * §4 in one shape: the cases sit together where they can be compared, and
 * nothing dispatches on them.
 *
 * `Answer` and not `Option`, because this package already says "options" for the
 * arguments a caller passes — `IRunLankaInitCliOptions`, `planLankaInit(options)`
 * — and a reader meeting `ILankaInitOption` in a signature could not tell a CLI
 * flag from a validator. A question has answers; what was answered is
 * `ILankaInitChoices`.
 */
export interface ILankaInitAnswer {
	/** What `--validator zod` is typed as, and what a plan records. */
	readonly id: string;
	/** One line, shown beside the id when the question is asked. */
	readonly title: string;
	/** Why somebody would take this answer rather than the one above it. */
	readonly gist: string;
	/** npm names this answer adds to `dependencies`. */
	readonly packages: readonly string[];
	/**
	 * npm names it adds to `devDependencies`.
	 *
	 * A second list rather than a flag on each name, because the two are read at
	 * different moments: one becomes `pnpm add`, the other `pnpm add -D`, and a
	 * flag per name would be read by a filter in both.
	 */
	readonly devPackages: readonly string[];
	/**
	 * Every runtime this answer can run in — the same three words
	 * `scripts/registry.mjs` declares for the package it names.
	 *
	 * Required rather than optional, and `skills/surface/SKILL.md` 6d.8 is the
	 * reason: an absent field needs a documented meaning, and this is data this
	 * package authors rather than input it receives, so there is nobody to
	 * default for. A template offers only the answers its own runtimes allow —
	 * `@lankajs/mmkv` is native, and an answer that cannot work is worse than a
	 * shorter list, because whoever picks it finds out at build time.
	 */
	readonly runtime: readonly TLankaInitRuntime[];
	/** What to read next: a path inside the repository, or a URL. */
	readonly guide?: string;
}
