import type { IPlaygroundReadCache } from "./IPlaygroundReadCache";

/** The list ViewModel exists for the cache: without one, two lists are two requests. */
export interface IPlaygroundOrdersServices {
	cache: IPlaygroundReadCache;
}
