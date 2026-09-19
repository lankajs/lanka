import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/**
 * What every adapter takes.
 *
 * Shared rather than declared twice: the two plugins differ in how a bundler is
 * told things, not in what a consumer decides, and two copies of this would be
 * two places for `scaffold` to mean something slightly different.
 */
export interface ILankaDiPluginOptions {
	/**
	 * Where the consumer's project root is.
	 *
	 * Defaults to what the bundler already knows — vite's resolved root, or
	 * webpack's `context` — and to the working directory when neither says.
	 */
	readonly root?: string;
	/**
	 * Scaffold missing barrels instead of failing. On by default.
	 *
	 * TURN THIS OFF in CI: there, a barrel directory that had to be generated means
	 * it was never committed, and a build that quietly repairs itself hides that
	 * until the project is built on another machine.
	 */
	readonly scaffold?: boolean;
	/**
	 * Which barrel directory this project uses: `.lanka` or `.lanka_di`.
	 *
	 * Rarely needed. Left out — which is how every existing config reads — the
	 * directory is found on disk, so a project keeps whichever one it has and a
	 * project with neither gets the default. Set it when the answer should be
	 * written down rather than discovered: a monorepo generating configs, or a
	 * team that wants the choice reviewable in a diff.
	 *
	 * It does NOT move anything. A `dirname` naming a directory that is not there
	 * is a directory that gets scaffolded, and the old one stays where it is —
	 * `lanka-di migrate` is what moves barrels.
	 */
	readonly dirname?: TLankaDiDirname;
}
