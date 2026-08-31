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
	 * TURN THIS OFF in CI: there, a `.lanka_di` that had to be generated means it
	 * was never committed, and a build that quietly repairs itself hides that
	 * until the project is built on another machine.
	 */
	readonly scaffold?: boolean;
}
