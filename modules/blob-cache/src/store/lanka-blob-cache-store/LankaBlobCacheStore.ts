import { BLOB_CACHE_BACKEND } from "../blobCacheBackend";
import type { TLankaBlobCacheBackend } from "../blobCacheBackend";
import {
	LankaIndexedDbAdapter,
	type ILankaBlobRecord,
	type ILankaBlobStoreAdapter,
} from "@lankajs/storage";
import { LankaCacheStorageBlobAdapter } from "../../lanka-cache-storage-blob-adapter/LankaCacheStorageBlobAdapter";
import {
	LANKA_BLOB_CACHE_CONFIG,
	type TLankaBlobCacheConfig,
} from "../../lanka-blob-cache-config/lankaBlobCacheConfig";

/** The environment is injected, so the whole chain is testable without a browser. */
export interface ILankaBlobCacheEnvironment {
	/** `undefined` when the platform has no IndexedDB at all. */
	indexedDb?: IDBFactory;
	/** `undefined` when the platform has no Cache Storage, or the context is insecure. */
	caches?: CacheStorage;
	now: () => number;
	/**
	 * Returns `null` when the platform cannot mint object URLs; the caller then
	 * serves the network URL. Separate also so a test can assert that eviction
	 * revokes what it handed out.
	 */
	createObjectUrl: (blob: Blob) => string | null;
	revokeObjectUrl: (url: string) => void;
}

/**
 * One rung of the chain: a label plus a builder that returns `null` when the
 * platform lacks the API. Declared explicitly so the chain's ORDER and its
 * degradation are testable without a browser.
 */
export interface IBlobCacheBackendCandidate {
	backend: TLankaBlobCacheBackend;
	build: () => ILankaBlobStoreAdapter | null;
}

/**
 * Whether the page hid, or unloaded, while something was being decided.
 *
 * Here rather than core's foreground clock: this module does not depend on the
 * framework, on purpose, and it needs less than a clock — only to know that a
 * failed probe is not evidence.
 */
function followPageHide(): { seen(): boolean; stop(): void } {
	if (typeof document === "undefined" || typeof window === "undefined") {
		return { seen: () => false, stop: () => undefined };
	}
	// Hidden from the start counts: a WebView started in the background, or a tab
	// probed while hidden, never sends the event the probe would wait for.
	let hidden = document.visibilityState === "hidden";
	const onVisibility = (): void => {
		if (document.visibilityState === "hidden") hidden = true;
	};
	const onPageHide = (): void => {
		hidden = true;
	};
	document.addEventListener("visibilitychange", onVisibility);
	window.addEventListener("pagehide", onPageHide);
	return {
		seen: () => hidden,
		stop: () => {
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("pagehide", onPageHide);
		},
	};
}

/**
 * Persistent blob storage reached through a chain of rungs.
 *
 * The chain exists because the app runs in whatever WebView the client embeds,
 * and storage support there is genuinely uneven:
 *
 * 1. **IndexedDB** — the only rung with a real quota and blob support.
 * 2. **Cache Storage** — present in some WebViews where IndexedDB is closed, and
 *    unlike a Service Worker it is reachable straight from the page.
 * 3. **Memory** — always works, dies with the session. That is exactly what the
 *    app had before the cache, so the worst case is the old behaviour rather
 *    than a broken image.
 *
 * A Service Worker is deliberately NOT in the chain: it would work for a small
 * share of clients, needs its own build and registration, and risks pinning a
 * stale version of the app inside the WebView.
 *
 * The rung is chosen ONCE by a write-and-read probe with a deadline: capability
 * detection alone is not enough — iOS private mode exposes `indexedDB` and then
 * leaves `open()` pending forever. A rung whose probe failed while the app was in
 * the background is probed once more before the chain steps down. Every later
 * operation is guarded anyway, so a
 * `QuotaExceededError` mid-session degrades instead of reaching the interface.
 */
export class LankaBlobCacheStore {
	private readonly config: TLankaBlobCacheConfig;
	private readonly env: ILankaBlobCacheEnvironment;
	private readonly candidates: readonly IBlobCacheBackendCandidate[];
	/** The third rung, and the write-through cache for the first two. */
	private readonly memory = new Map<string, ILankaBlobRecord>();
	private backend: TLankaBlobCacheBackend = BLOB_CACHE_BACKEND.MEMORY;
	private persistent: ILankaBlobStoreAdapter | null = null;
	private initialization: Promise<TLankaBlobCacheBackend> | null = null;

	constructor(
		env: ILankaBlobCacheEnvironment,
		config: TLankaBlobCacheConfig = LANKA_BLOB_CACHE_CONFIG,
		candidates?: readonly IBlobCacheBackendCandidate[],
	) {
		this.env = env;
		this.config = config;
		this.candidates = candidates ?? [
			{
				backend: BLOB_CACHE_BACKEND.INDEXED_DB,
				build: () => this.buildIndexedDbAdapter(),
			},
			{
				backend: BLOB_CACHE_BACKEND.CACHE_STORAGE,
				build: () => this.buildCacheStorageAdapter(),
			},
		];
	}

	/**
	 * Resolves the chain once; concurrent callers share one promise.
	 *
	 * Every async operation awaits this internally, so a write that happens while
	 * the probe is still running still reaches the persistent rung. Without it,
	 * images resolved in the first moments of a session would silently stay in
	 * memory only, and the cache would never fill.
	 */
	public init(): Promise<TLankaBlobCacheBackend> {
		if (!this.initialization) {
			this.initialization = this.resolveBackend();
		}
		return this.initialization;
	}

	public getBackend(): TLankaBlobCacheBackend {
		return this.backend;
	}

	/**
	 * Synchronous read from MEMORY ONLY. This is what allows an answer during
	 * render and therefore no later `src` swap: the persistent rungs are async and
	 * could not serve the first render.
	 */
	public peek(key: string): ILankaBlobRecord | null {
		const record = this.memory.get(key);
		if (!record) return null;
		if (this.isExpired(record)) {
			this.memory.delete(key);
			return null;
		}
		record.lastUsedAt = this.env.now();
		return record;
	}

	/**
	 * Lifts recently used entries into memory so `peek` can answer for them.
	 * Bounded, because each entry pins its blob. Returns how many were lifted, for
	 * logs and tests.
	 */
	public async hydrateRecent(limit: number): Promise<number> {
		const recent = await this.listRecent(limit);
		for (const record of recent) {
			this.memory.set(record.key, record);
		}
		this.enforceMemoryBudget();
		return recent.length;
	}

	public async get(key: string): Promise<ILankaBlobRecord | null> {
		await this.init();
		const fromMemory = this.memory.get(key);
		if (fromMemory) {
			// Touched on READ: otherwise eviction order would reflect when an entry
			// was written rather than what is being used.
			fromMemory.lastUsedAt = this.env.now();
			return fromMemory;
		}

		if (!this.persistent) return null;

		const record = await this.guard(() => this.persistent!.get(key), null);
		if (!record) return null;

		if (this.isExpired(record)) {
			await this.delete(key);
			return null;
		}

		this.memory.set(key, record);
		this.enforceMemoryBudget();
		return record;
	}

	public async put(key: string, blob: Blob): Promise<void> {
		if (blob.size > this.config.maxEntryBytes) return;
		await this.init();

		const record: ILankaBlobRecord = {
			key,
			blob,
			lastUsedAt: this.env.now(),
			size: blob.size,
		};
		this.memory.set(key, record);
		this.enforceMemoryBudget();

		if (!this.persistent) return;

		const written = await this.guard(async () => {
			await this.persistent!.put(record);
			return true;
		}, false);

		// A rejected write almost always means quota: free space and try once
		// more. A second failure is not something the user should hear about — the
		// image still renders from the network, it just will not outlive the
		// session.
		if (!written) {
			await this.evictOldest();
			await this.guard(async () => {
				await this.persistent!.put(record);
				return true;
			}, false);
			return;
		}

		await this.enforceBudget();
	}

	public async delete(key: string): Promise<void> {
		await this.init();
		this.memory.delete(key);
		if (!this.persistent) return;
		await this.guard(async () => {
			await this.persistent!.delete(key);
			return true;
		}, false);
	}

	/**
	 * Recently used entries, capped at `limit`.
	 *
	 * The policy turns this list into object URLs before the first render — the
	 * only reason a cached image can be served synchronously, and therefore
	 * without flicker.
	 */
	public async listRecent(limit: number): Promise<ILankaBlobRecord[]> {
		await this.init();
		if (!this.persistent) return [];
		const all = await this.guard(() => this.persistent!.listByAge(), [] as ILankaBlobRecord[]);
		const fresh = all.filter((record) => !this.isExpired(record));
		const expired = all.filter((record) => this.isExpired(record));
		// Expired entries are swept on the way: the list is already in hand.
		for (const record of expired) {
			await this.delete(record.key);
		}
		return fresh.slice(-limit).reverse();
	}

	/** Drops everything. Called on sign-out: cached images are other people's faces. */
	public async clear(): Promise<void> {
		await this.init();
		this.memory.clear();
		if (!this.persistent) return;
		await this.guard(async () => {
			await this.persistent!.clear();
			return true;
		}, false);
	}

	// ────────────────────────────────────────────────────
	// Choosing a rung
	// ────────────────────────────────────────────────────

	private async resolveBackend(): Promise<TLankaBlobCacheBackend> {
		for (const candidate of this.candidates) {
			let adapter: ILankaBlobStoreAdapter | null = null;
			try {
				adapter = candidate.build();
			} catch {
				// A builder that throws (say `caches.open` in an insecure context) must
				// cost us its own rung only, not the whole chain.
				adapter = null;
			}
			if (!adapter) continue;
			if (!(await this.probeInForeground(adapter))) continue;

			this.persistent = adapter;
			this.backend = candidate.backend;
			return this.backend;
		}

		// The last rung: exactly the behaviour that existed before this cache —
		// "nothing persisted", not a broken image.
		this.persistent = null;
		this.backend = BLOB_CACHE_BACKEND.MEMORY;
		return this.backend;
	}

	private buildIndexedDbAdapter(): ILankaBlobStoreAdapter | null {
		if (!this.env.indexedDb) return null;
		try {
			return new LankaIndexedDbAdapter(
				this.env.indexedDb,
				this.config.dbName,
				this.config.dbVersion,
			);
		} catch {
			return null;
		}
	}

	private buildCacheStorageAdapter(): ILankaBlobStoreAdapter | null {
		const cacheStorage = this.env.caches;
		if (!cacheStorage) return null;
		return new LankaCacheStorageBlobAdapter(
			cacheStorage,
			this.config.cacheStorageName,
			this.env.now,
		);
	}

	/**
	 * A probe, and once more if the app was in the background while it ran.
	 *
	 * A failure there is not evidence: a WebView frozen mid-probe fires the
	 * deadline on resume. Stepping down the chain on it kept a lower rung — Cache
	 * Storage on a device whose IndexedDB works, or memory — for the session, and
	 * every image was fetched again. The SAME rung, on the same adapter, is probed
	 * once more before the chain moves on, so the rung is still chosen once and
	 * never changes under a running session.
	 */
	private async probeInForeground(adapter: ILankaBlobStoreAdapter): Promise<boolean> {
		const hide = followPageHide();
		try {
			if (await this.probe(adapter)) return true;
			return hide.seen() ? await this.probe(adapter) : false;
		} finally {
			hide.stop();
		}
	}

	/**
	 * A write-read-delete round trip under a deadline.
	 *
	 * Capability detection is not enough: these APIs exist in contexts where they
	 * do not work, and in iOS private mode `open()` neither resolves nor rejects.
	 */
	private async probe(adapter: ILankaBlobStoreAdapter): Promise<boolean> {
		const key = "__probe__";
		const probeRun = (async () => {
			const record: ILankaBlobRecord = {
				key,
				blob: new Blob([new Uint8Array([1])]),
				lastUsedAt: this.env.now(),
				size: 1,
			};
			await adapter.put(record);
			const read = await adapter.get(key);
			await adapter.delete(key);
			return read !== null;
		})();

		try {
			return await this.withTimeout(probeRun);
		} catch {
			return false;
		}
	}

	private withTimeout<T>(promise: Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("blob cache probe timed out")),
				this.config.probeTimeoutMs,
			);
			promise.then(
				(value) => {
					clearTimeout(timer);
					resolve(value);
				},
				(error: unknown) => {
					clearTimeout(timer);
					// Coerced to `Error`: a promise rejected with a non-error loses its
					// stack and prints as "[object Object]" wherever it is logged. Real
					// errors pass through untouched.
					reject(error instanceof Error ? error : new Error(String(error)));
				},
			);
		});
	}

	// ────────────────────────────────────────────────────
	// Housekeeping
	// ────────────────────────────────────────────────────

	private isExpired(record: ILankaBlobRecord): boolean {
		return this.env.now() - record.lastUsedAt > this.config.ttlMs;
	}

	/**
	 * Trims the MEMORY tier, least recently used first.
	 *
	 * Separate from {@link enforceBudget} and deliberately NOT via `delete()`:
	 * only the in-memory reference is dropped and the persistent copy must stay —
	 * the entry is still cached, just not resident. The next read returns it from
	 * the rung below.
	 *
	 * Safe for rendering: object URLs belong to the policy, which contractually
	 * keeps them stable for the session, and a live object URL holds its own
	 * reference to the blob.
	 */
	private enforceMemoryBudget(): void {
		let total = 0;
		for (const record of this.memory.values()) total += record.size;
		if (total <= this.config.maxMemoryBytes) return;

		const byAge = [...this.memory.values()].sort(
			(left, right) => left.lastUsedAt - right.lastUsedAt,
		);
		for (const record of byAge) {
			if (total <= this.config.maxMemoryBytes) break;
			this.memory.delete(record.key);
			total -= record.size;
		}
	}

	/**
	 * What the memory tier holds right now — for the inspector and for tests
	 * asserting that the budget actually binds.
	 */
	public getMemoryDiagnostics(): { entries: number; bytes: number } {
		let bytes = 0;
		for (const record of this.memory.values()) bytes += record.size;
		return { entries: this.memory.size, bytes };
	}

	private async enforceBudget(): Promise<void> {
		if (!this.persistent) return;
		const all = await this.guard(() => this.persistent!.listByAge(), [] as ILankaBlobRecord[]);
		const total = all.reduce((sum, record) => sum + record.size, 0);
		if (total <= this.config.maxTotalBytes) return;
		await this.evictOldest(all);
	}

	private async evictOldest(known?: ILankaBlobRecord[]): Promise<void> {
		if (!this.persistent) return;
		const all =
			known ??
			(await this.guard(() => this.persistent!.listByAge(), [] as ILankaBlobRecord[]));
		if (all.length === 0) return;

		const dropCount = Math.max(1, Math.ceil(all.length * this.config.evictionRatio));
		for (const record of all.slice(0, dropCount)) {
			await this.delete(record.key);
		}
	}

	/** Runs a storage operation, degrading to `fallback` on any failure. */
	private async guard<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
		try {
			return await operation();
		} catch {
			return fallback;
		}
	}
}
