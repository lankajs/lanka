import { LankaTanstackCache } from "../../lanka-tanstack-cache/LankaTanstackCache";
import type { QueryClient } from "@tanstack/query-core";

/**
 * The functional style of `LankaTanstackCache`.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other.
 */
export const createLankaTanstackCache = (client: QueryClient): LankaTanstackCache =>
	new LankaTanstackCache(client);
