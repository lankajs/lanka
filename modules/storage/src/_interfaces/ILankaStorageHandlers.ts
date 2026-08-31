import type { ILankaStorageHandler } from "./ILankaStorageHandler";

/**
 * The three spaces a storage writes to, when an application supplies its own.
 *
 * Every field is optional: an absent one is created lazily from the browser's
 * default, which is what the ambient instance uses.
 */
export interface ILankaStorageHandlers {
	local?: ILankaStorageHandler;
	session?: ILankaStorageHandler;
	cache?: ILankaStorageHandler;
}
