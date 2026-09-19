import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { otherLankaDiDirname } from "../_utils/other-lanka-di-dirname/otherLankaDiDirname";
import { withoutCommentedLines } from "../_utils/without-commented-lines/withoutCommentedLines";
import type { ILankaBarrelSpec, TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/** Where one barrel actually is, across both legal directories. */
export interface ILankaDiShard {
	/** The barrel this is about. */
	readonly barrel: ILankaBarrelSpec;
	/** Every directory holding a file by that name, the primary first. */
	readonly holders: readonly TLankaDiDirname[];
	/**
	 * The primary's copy re-exports the secondary's.
	 *
	 * `false` when there is nothing to bridge, so a caller has to ask `holders`
	 * what the answer means. That is deliberate: a bridge with no shard behind it
	 * and a shard with no bridge in front of it are different mistakes, and a
	 * single boolean that conflated them could only produce one message.
	 */
	readonly bridged: boolean;
}

/**
 * Which of the two directories holds each barrel, and whether they are joined.
 *
 * ## Why a project may have both
 *
 * `.lanka` and `.lanka_di` are both legal and a project may use them TOGETHER —
 * by abstraction, keeping its gateways in one and its host in the other, or by
 * shard, keeping some of its gateways in each. Neither split means anything to
 * the framework, which is the point: the axis belongs to the team, and this
 * package's job is to make whichever one they chose resolve and stay honest.
 *
 * ## What it reads and what it deliberately does not
 *
 * The file SYSTEM, plus one line of each primary barrel. It does not parse the
 * modules, does not follow the bridge, and does not decide anything — three
 * facts per barrel, and `verifyLankaDi` turns them into messages.
 *
 * The primary comes from `resolveLankaDiDir` and is passed in rather than looked
 * up again. Resolving twice inside one run is how the alias and the check end up
 * naming different directories when one is scaffolded in between.
 */
export const resolveLankaDiShards = (
	root: string,
	primary: TLankaDiDirname,
): readonly ILankaDiShard[] => {
	const secondary = otherLankaDiDirname(primary);

	return lankaDiContract.barrels.map((barrel) => {
		const holders = [primary, secondary].filter((dirname) =>
			existsSync(join(root, dirname, barrel.file)),
		);

		return {
			barrel,
			holders,
			bridged: holders.includes(primary)
				? bridges(readFileSync(join(root, primary, barrel.file), "utf8"), secondary, barrel)
				: false,
		};
	});
};

/**
 * Whether this source carries the bridge line for its barrel.
 *
 * ## A reader of somebody else's file, not a mirror of the writer
 *
 * `lankaDiBridge` emits ONE form and this accepts a SET, and the asymmetry is
 * deliberate. The line lives in a consumer's repository: it is hand-typed as
 * often as it is written, reformatted by whatever prettier config they keep, and
 * once written it stays there across upgrades of this package. A recogniser
 * derived from the writer would un-recognise every bridge already on disk the
 * day the writer changed a character, and tell all of those projects their
 * shards are unreachable — on a minor.
 *
 * So this reads the PATH, in the forms a WORKING bridge can legally take:
 *
 * - either quote style, because that is a formatter setting;
 * - with or without an extension, because `"moduleResolution": "NodeNext"`
 *   requires one — a consumer on it writes `../.lanka_di/Gateways.js` and their
 *   compiler rejects the extensionless form this package prefers.
 *
 * A template literal is deliberately NOT one of them. A module specifier must be
 * a string literal, so `export * from \`…\`` is a syntax error and no backtick
 * occurrence can ever be a bridge that works. What a backtick around this path
 * IS, is a dynamic `import(\`../.lanka_di/Gateways\`)` — somebody lazy-loading
 * their own barrel — and reading that as a bridge tells them their split is
 * healthy while the locator is empty, which is the exact failure this check
 * exists to catch.
 *
 * Whatever is added here, nothing is ever removed: a form once accepted is a
 * form somebody's repository is relying on. `lankaDiContract` says so beside the
 * alias, and it is why the backtick had to go before the first release and not
 * after.
 *
 * ## What it still accepts and should not
 *
 * The path is matched, not the statement, so `export type * from "…"` reads as a
 * bridge. It type-checks, emits nothing, and leaves the locator empty at
 * runtime — and it is what a "prefer type-only exports" autofix would write.
 * Refusing it means parsing the statement rather than the specifier, which buys
 * this one case at the cost of every formatting a re-export may legally have.
 * Known, chosen, and written down here and in `tools/di/SKILL.md` 6h rather than
 * discovered later by somebody reading the regex.
 *
 * Matched on the specifier rather than on the whole line, because a re-export
 * may be wrapped, may carry a trailing comment, and may have been moved.
 * Commented-out lines are dropped first — a bridge somebody disabled while
 * debugging is a bridge that is not there, and reading it as present is how the
 * shard behind it goes missing with the check still green.
 */
const bridges = (source: string, secondary: TLankaDiDirname, barrel: ILankaBarrelSpec): boolean => {
	const name = barrel.file.replace(/\.ts$/, "");
	const path = `../${secondary}/${name}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	return new RegExp(`(["'])${path}(?:\\.(?:ts|js|mts|mjs|cts|cjs))?\\1`).test(
		withoutCommentedLines(source),
	);
};
