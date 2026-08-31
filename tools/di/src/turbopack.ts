/**
 * The turbopack half, behind its own subpath.
 *
 * A subpath rather than the root barrel so a consumer resolves the adapter their
 * build uses and never a module written for another bundler.
 */
export { lankaDiTurbopack } from "./lanka-di-turbopack/lankaDiTurbopack";
export type { ILankaTurbopackConfig } from "./lanka-di-turbopack/lankaDiTurbopack";
