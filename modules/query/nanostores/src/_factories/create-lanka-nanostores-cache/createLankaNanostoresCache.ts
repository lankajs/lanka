import { LankaNanostoresCache } from "../../lanka-nanostores-cache/LankaNanostoresCache";
import type { TLankaNanostoresClient } from "../../lanka-nanostores-cache/LankaNanostoresCache";

/**
 * The functional style of `LankaNanostoresCache`.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other.
 */
export const createLankaNanostoresCache = (
	nanoquery: TLankaNanostoresClient,
): LankaNanostoresCache => new LankaNanostoresCache(nanoquery);
