/**
 * The esbuild half, behind its own subpath.
 *
 * A subpath rather than the root barrel so a consumer resolves the adapter their
 * build uses and never a module written for another bundler.
 */
export { lankaDiEsbuild } from "./lanka-di-esbuild/lankaDiEsbuild";
export type { ILankaEsbuildBuild, ILankaEsbuildPlugin } from "./lanka-di-esbuild/lankaDiEsbuild";
