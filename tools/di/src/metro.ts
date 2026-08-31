/**
 * The Metro half, behind its own subpath.
 *
 * A subpath rather than the root barrel so a web consumer never resolves a
 * module written for React Native, and the other way round.
 */
export { lankaDiMetro } from "./lanka-di-metro/lankaDiMetro";
export type {
	ILankaMetroConfig,
	ILankaMetroResolver,
	TLankaMetroConfig,
} from "./lanka-di-metro/lankaDiMetro";
