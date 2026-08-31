/**
 * The rollup half, behind its own subpath.
 *
 * A subpath rather than the root barrel so a consumer resolves the adapter their
 * build uses and never a module written for another bundler.
 */
export { lankaDiRollup } from "./lanka-di-rollup/lankaDiRollup";
export type { ILankaRollupPlugin } from "./lanka-di-rollup/lankaDiRollup";
