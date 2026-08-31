import { ILankaAsyncStorageAdapter } from "../../_interfaces/ILankaAsyncStorageAdapter";
import { ILankaSyncStorageAdapter } from "../../_interfaces/ILankaSyncStorageAdapter";

/**
 * `localStorage` and `sessionStorage`, as the handlers `LankaStorage` takes.
 *
 * Published for the same reason as its two siblings: a storage built by hand is
 * given its handlers, and these are the ones the ambient instance uses.
 */
export class LankaWebStorageAdapter implements ILankaAsyncStorageAdapter, ILankaSyncStorageAdapter {
	// `Storage` here is the browser GLOBAL (the type of localStorage and
	// sessionStorage), not this package's class. Nothing distinguished them before
	// the brand, which is exactly why our class is now `LankaStorage`.
	private storage: Storage;

	constructor(storage: Storage) {
		this.storage = storage;
	}

	async setItem(key: string, value: string): Promise<void> {
		this.storage.setItem(key, value);
	}

	async getItem(key: string): Promise<string | null> {
		return this.storage.getItem(key);
	}

	async removeItem(key: string): Promise<void> {
		this.storage.removeItem(key);
	}

	async clear(): Promise<void> {
		this.storage.clear();
	}

	setItemSync(key: string, value: string): void {
		this.storage.setItem(key, value);
	}

	getItemSync(key: string): string | null {
		return this.storage.getItem(key);
	}

	removeItemSync(key: string): void {
		this.storage.removeItem(key);
	}

	clearSync(): void {
		this.storage.clear();
	}
}
