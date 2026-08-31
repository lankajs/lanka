import { LankaWebStorageAdapter } from "../_adapters/lanka-web-storage-adapter/LankaWebStorageAdapter";
import { LankaCacheStorageAdapter } from "../_adapters/lanka-cache-storage-adapter/LankaCacheStorageAdapter";
import { ILankaStorageHandler } from "../_interfaces/ILankaStorageHandler";
import type { ILankaStorageHandlers } from "../_interfaces/ILankaStorageHandlers";
import { ILankaSyncStorageAdapter } from "../_interfaces/ILankaSyncStorageAdapter";
import { lankaLogger } from "lanka/logger";

/** A storage handler that also supports synchronous access. */
type TSyncCapableHandler = ILankaStorageHandler & ILankaSyncStorageAdapter;

/**
 * Narrows a handler to one supporting synchronous access.
 *
 * The sync methods are an optional capability: not every adapter declares them.
 * So a caller must ask first rather than force the type.
 */
function supportsSyncStorage(handler: ILankaStorageHandler): handler is TSyncCapableHandler {
	const candidate = handler as Partial<ILankaSyncStorageAdapter>;
	return (
		typeof candidate.setItemSync === "function" &&
		typeof candidate.getItemSync === "function" &&
		typeof candidate.removeItemSync === "function"
	);
}

/**
 * Local, session and cache storage behind one API that cannot throw at import.
 *
 * The ambient one is `lankaStorage` and is what an application writes. The class
 * is here because a second key space is a real need — a per-tenant store, or a
 * test filling one without touching what the page wrote — and it takes its own
 * handlers for exactly that.
 */
export class LankaStorage {
	/**
	 * Handlers are created ON FIRST USE rather than at class definition.
	 *
	 * Static field initialisers run on module import, and these touch
	 * `localStorage` and `sessionStorage` — so the package throws "localStorage is
	 * not defined" in node from an `import` alone. No vitest run catches that:
	 * jsdom is always there. The build verification, which installs a tarball into
	 * a temporary project and runs it in plain node, does.
	 *
	 * Assignment is kept: tests substitute the handler, which is legitimate — an
	 * assigned value simply beats lazy creation.
	 */
	private localHandler: ILankaStorageHandler | null = null;
	private sessionHandler: ILankaStorageHandler | null = null;
	private cacheHandler: ILankaStorageHandler | null = null;

	/**
	 * A storage of ones own, over adapters the application chose.
	 *
	 * The ambient `lankaStorage` below is the one every caller wants. A second
	 * instance is what an application builds when it needs a different SPACE — a
	 * cache under another name, a tenants own keys, a test that must not touch
	 * the page — and it was impossible while this was a namespace of statics.
	 */
	public constructor(handlers: ILankaStorageHandlers = {}) {
		this.localHandler = handlers.local ?? null;
		this.sessionHandler = handlers.session ?? null;
		this.cacheHandler = handlers.cache ?? null;
	}

	protected get localStorageHandler(): ILankaStorageHandler {
		this.localHandler ??= new LankaWebStorageAdapter(localStorage);
		return this.localHandler;
	}
	protected set localStorageHandler(handler: ILankaStorageHandler) {
		this.localHandler = handler;
	}

	protected get sessionStorageHandler(): ILankaStorageHandler {
		this.sessionHandler ??= new LankaWebStorageAdapter(sessionStorage);
		return this.sessionHandler;
	}
	protected set sessionStorageHandler(handler: ILankaStorageHandler) {
		this.sessionHandler = handler;
	}

	protected get cacheStorageHandler(): ILankaStorageHandler {
		this.cacheHandler ??= new LankaCacheStorageAdapter("app_cache");
		return this.cacheHandler;
	}
	protected set cacheStorageHandler(handler: ILankaStorageHandler) {
		this.cacheHandler = handler;
	}

	protected localMemoryCache = new Map<string, string | null>();
	protected sessionMemoryCache = new Map<string, string | null>();
	protected cacheMemoryCache = new Map<string, string | null>();

	protected async readThroughCache(
		handler: ILankaStorageHandler,
		cache: Map<string, string | null>,
		key: string,
		isCareful: boolean = false,
	): Promise<string | null> {
		if (!isCareful && cache.has(key)) {
			return cache.get(key)!;
		}
		const value = await handler.getItem(key);
		cache.set(key, value);

		return value;
	}

	protected async runTransaction(
		handler: ILankaStorageHandler,
		cache: Map<string, string | null>,
		key: string,
		newValue: string | null,
	): Promise<void> {
		let oldValue: string | null;

		if (cache.has(key)) {
			oldValue = cache.get(key)!;
		} else {
			oldValue = await handler.getItem(key);
		}

		try {
			const memoryOp = new Promise<void>((resolve, reject) => {
				try {
					if (newValue === null) {
						cache.delete(key);
					} else {
						cache.set(key, newValue);
					}
					resolve();
				} catch (e: unknown) {
					reject(e instanceof Error ? e : new Error(String(e)));
				}
			});

			const diskOp =
				newValue === null ? handler.removeItem(key) : handler.setItem(key, newValue);

			await Promise.all([diskOp, memoryOp]);
		} catch (error) {
			lankaLogger.printBootstrapLog(
				`LankaStorage transaction failed for key "${key}". Rolling back...`,
				error,
			);

			if (oldValue !== null) cache.set(key, oldValue);
			else cache.delete(key);

			try {
				if (oldValue !== null) await handler.setItem(key, oldValue);
				else await handler.removeItem(key);
			} catch (rollbackError) {
				lankaLogger.printBootstrapLog(
					"Critical: Failed to rollback storage changes",
					rollbackError,
				);
			}

			throw error;
		}
	}

	// ---- LocalStorage ----

	async setLocal(key: string, value: string): Promise<void> {
		await this.runTransaction(this.localStorageHandler, this.localMemoryCache, key, value);
	}

	async getLocal(key: string, isCareful: boolean = false): Promise<string | null> {
		return await this.readThroughCache(
			this.localStorageHandler,
			this.localMemoryCache,
			key,
			isCareful,
		);
	}

	async removeLocal(key: string): Promise<void> {
		await this.runTransaction(this.localStorageHandler, this.localMemoryCache, key, null);
	}

	async clearLocal(): Promise<void> {
		try {
			await Promise.all([
				this.localStorageHandler.clear(),
				Promise.resolve(this.localMemoryCache.clear()),
			]);
		} catch (e) {
			this.localMemoryCache.clear();
			throw e;
		}
	}

	// ---- Synchronous localStorage ----

	setLocalSync(key: string, value: string): void {
		if (this.localStorageHandler && supportsSyncStorage(this.localStorageHandler)) {
			this.localStorageHandler.setItemSync(key, value);
			this.localMemoryCache.set(key, value);
		} else {
			throw new Error("Sync methods are not available for this storage handler");
		}
	}

	getLocalSync(key: string, isCareful: boolean = false): string | null {
		if (!isCareful && this.localMemoryCache.has(key)) {
			return this.localMemoryCache.get(key)!;
		}
		if (this.localStorageHandler && supportsSyncStorage(this.localStorageHandler)) {
			const value = this.localStorageHandler.getItemSync(key);
			this.localMemoryCache.set(key, value);
			return value;
		}
		throw new Error("Sync methods are not available for this storage handler");
	}

	removeLocalSync(key: string): void {
		if (this.localStorageHandler && supportsSyncStorage(this.localStorageHandler)) {
			this.localStorageHandler.removeItemSync(key);
			this.localMemoryCache.delete(key);
		} else {
			throw new Error("Sync methods are not available for this storage handler");
		}
	}

	// ---- SessionStorage ----

	async setSession(key: string, value: string): Promise<void> {
		await this.runTransaction(this.sessionStorageHandler, this.sessionMemoryCache, key, value);
	}

	async getSession(key: string, isCareful: boolean = false): Promise<string | null> {
		return await this.readThroughCache(
			this.sessionStorageHandler,
			this.sessionMemoryCache,
			key,
			isCareful,
		);
	}

	async removeSession(key: string): Promise<void> {
		await this.runTransaction(this.sessionStorageHandler, this.sessionMemoryCache, key, null);
	}

	async clearSession(): Promise<void> {
		try {
			await Promise.all([
				this.sessionStorageHandler.clear(),
				Promise.resolve(this.sessionMemoryCache.clear()),
			]);
		} catch (e) {
			this.sessionMemoryCache.clear();
			throw e;
		}
	}

	// ---- Synchronous sessionStorage ----

	setSessionSync(key: string, value: string): void {
		if (this.sessionStorageHandler && supportsSyncStorage(this.sessionStorageHandler)) {
			this.sessionStorageHandler.setItemSync(key, value);
			this.sessionMemoryCache.set(key, value);
		} else {
			throw new Error("Sync methods are not available for this storage handler");
		}
	}

	getSessionSync(key: string, isCareful: boolean = false): string | null {
		if (!isCareful && this.sessionMemoryCache.has(key)) {
			return this.sessionMemoryCache.get(key)!;
		}
		if (this.sessionStorageHandler && supportsSyncStorage(this.sessionStorageHandler)) {
			const value = this.sessionStorageHandler.getItemSync(key);
			this.sessionMemoryCache.set(key, value);
			return value;
		}
		throw new Error("Sync methods are not available for this storage handler");
	}

	removeSessionSync(key: string): void {
		if (this.sessionStorageHandler && supportsSyncStorage(this.sessionStorageHandler)) {
			this.sessionStorageHandler.removeItemSync(key);
			this.sessionMemoryCache.delete(key);
		} else {
			throw new Error("Sync methods are not available for this storage handler");
		}
	}

	// ---- CacheStorage ----

	async setCache(key: string, value: string): Promise<void> {
		await this.runTransaction(this.cacheStorageHandler, this.cacheMemoryCache, key, value);
	}

	async getCache(key: string, isCareful: boolean = false): Promise<string | null> {
		return await this.readThroughCache(
			this.cacheStorageHandler,
			this.cacheMemoryCache,
			key,
			isCareful,
		);
	}
	async removeCache(key: string): Promise<void> {
		await this.runTransaction(this.cacheStorageHandler, this.cacheMemoryCache, key, null);
	}

	async clearCache(): Promise<void> {
		try {
			await Promise.all([
				this.cacheStorageHandler.clear(),
				Promise.resolve(this.cacheMemoryCache.clear()),
			]);
		} catch (e) {
			this.cacheMemoryCache.clear();
			throw e;
		}
	}
}

/** The one every caller wants: three lifetimes over the default adapters. */
export const lankaStorage = new LankaStorage();
