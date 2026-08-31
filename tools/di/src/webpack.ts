/**
 * The webpack half, behind its own subpath.
 *
 * A subpath rather than the root barrel so a vite consumer never resolves a
 * module written for the other bundler, and the other way round.
 */
export { lankaDiWebpack } from "./lanka-di-webpack/lankaDiWebpack";
export type {
	ILankaWebpackCompiler,
	ILankaWebpackPlugin,
	TLankaWebpackHook,
} from "./lanka-di-webpack/lankaDiWebpack";
