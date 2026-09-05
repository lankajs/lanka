import type { ILankaBlobRecord, ILankaBlobStoreAdapter } from "@lankajs/storage";
import type { ILankaBlobCacheEnvironment } from "../store/lanka-blob-cache-store/LankaBlobCacheStore";
import {
	LANKA_BLOB_CACHE_CONFIG,
	type TLankaBlobCacheConfig,
} from "../lanka-blob-cache-config/lankaBlobCacheConfig";

/**
 * The real config is `as const`, so its numbers are literal types and an
 * override like `{ ttlMs: 100 }` would not type-check. This widens them back to
 * plain numbers, for tests only.
 */
export type TBlobCacheConfigOverrides = Partial<{
	[K in keyof TLankaBlobCacheConfig]: TLankaBlobCacheConfig[K] extends number
		? number
		: TLankaBlobCacheConfig[K];
}>;

export const withBlobCacheConfig = (
	overrides: TBlobCacheConfigOverrides = {},
): TLankaBlobCacheConfig => ({
	...LANKA_BLOB_CACHE_CONFIG,
	...overrides,
});

/**
 * Shared doubles for the image-cache tests.
 *
 * Everything the cache touches is injected, so the whole fallback chain can be
 * exercised in jsdom — which has neither IndexedDB nor Cache Storage, that is
 * exactly the "no persistent backend" WebView we must degrade to gracefully.
 */

export const makeBlob = (bytes = 8): Blob =>
	new Blob([new Uint8Array(bytes)], { type: "image/webp" });

export interface IFakeClock {
	now: () => number;
	advance: (ms: number) => void;
}

export const makeClock = (start = 1_000_000): IFakeClock => {
	let current = start;
	return {
		now: () => current,
		advance: (ms) => {
			current += ms;
		},
	};
};

export interface IObjectUrlTracker {
	created: string[];
	revoked: string[];
	createObjectUrl: (blob: Blob) => string;
	revokeObjectUrl: (url: string) => void;
	live: () => string[];
}

export const makeObjectUrlTracker = (): IObjectUrlTracker => {
	const created: string[] = [];
	const revoked: string[] = [];
	let counter = 0;
	return {
		created,
		revoked,
		createObjectUrl: () => {
			counter += 1;
			const url = `blob:fake/${counter}`;
			created.push(url);
			return url;
		},
		revokeObjectUrl: (url) => {
			revoked.push(url);
		},
		live: () => created.filter((url) => !revoked.includes(url)),
	};
};

/** An in-memory stand-in for a working persistent backend. */
export class FakeBlobStoreAdapter implements ILankaBlobStoreAdapter {
	public readonly records = new Map<string, ILankaBlobRecord>();
	public putCalls = 0;
	/** When set, the NEXT `put` rejects with this error, then it clears. */
	public failNextPut: Error | null = null;
	/** When true, every operation rejects — a revoked or broken store. */
	public failAlways = false;

	public async get(key: string): Promise<ILankaBlobRecord | null> {
		this.assertUsable();
		return this.records.get(key) ?? null;
	}

	public async put(record: ILankaBlobRecord): Promise<void> {
		this.assertUsable();
		this.putCalls += 1;
		if (this.failNextPut) {
			const error = this.failNextPut;
			this.failNextPut = null;
			throw error;
		}
		this.records.set(record.key, { ...record });
	}

	public async delete(key: string): Promise<void> {
		this.assertUsable();
		this.records.delete(key);
	}

	public async listByAge(): Promise<ILankaBlobRecord[]> {
		this.assertUsable();
		return [...this.records.values()].sort((left, right) => left.lastUsedAt - right.lastUsedAt);
	}

	public async clear(): Promise<void> {
		this.assertUsable();
		this.records.clear();
	}

	private assertUsable(): void {
		if (this.failAlways) throw new Error("store unavailable");
	}
}

/** A backend that never settles — `indexedDB.open()` in iOS private mode. */
export class HangingBlobStoreAdapter implements ILankaBlobStoreAdapter {
	public get(): Promise<ILankaBlobRecord | null> {
		return new Promise(() => undefined);
	}
	public put(): Promise<void> {
		return new Promise(() => undefined);
	}
	public delete(): Promise<void> {
		return new Promise(() => undefined);
	}
	public listByAge(): Promise<ILankaBlobRecord[]> {
		return new Promise(() => undefined);
	}
	public clear(): Promise<void> {
		return new Promise(() => undefined);
	}
}

export const makeEnvironment = (
	overrides: Partial<ILankaBlobCacheEnvironment> = {},
): ILankaBlobCacheEnvironment & {
	urls: IObjectUrlTracker;
	clock: IFakeClock;
} => {
	const urls = makeObjectUrlTracker();
	const clock = makeClock();
	return {
		indexedDb: undefined,
		caches: undefined,
		now: clock.now,
		createObjectUrl: urls.createObjectUrl,
		revokeObjectUrl: urls.revokeObjectUrl,
		urls,
		clock,
		...overrides,
	};
};

// ────────────────────────────────────────────────────
// Policy-level harness
// ────────────────────────────────────────────────────

/** Stable fixtures the policy tests share, so URL shapes stay comparable. */
export const BLOB_CACHE_URLS = {
	/** An immutable CDN object: stable, ours, cacheable. */
	S3: "https://bucket.s3.ap-southeast-1.amazonaws.com/public/a.webp",
	OTHER_S3: "https://bucket.s3.ap-southeast-1.amazonaws.com/public/b.webp",
	/**
	 * A host the consumer declared unreachable cross-origin.
	 *
	 * A concrete third-party host here would pretend the package knows about that
	 * service. It does not: the host list is configuration, and tests that need
	 * blocking set it explicitly.
	 */
	BLOCKED: "https://blocked.example/i/userpic/320/abc.jpg",
	/** A same-origin build asset. */
	BUNDLE: "/logo.svg",
} as const;

export const makeImageResponse = (bytes = 8) =>
	({
		ok: true,
		headers: {
			get: (name: string) => (name.toLowerCase() === "content-type" ? "image/webp" : null),
		},
		blob: () => Promise.resolve(makeBlob(bytes)),
	}) as unknown as Response;

export const makeErrorResponse = (status = 404) =>
	({
		ok: false,
		status,
		headers: { get: () => null },
		blob: () => Promise.resolve(makeBlob()),
	}) as unknown as Response;

/** HTML served where an image was expected: a captive portal or a sign-in redirect. */
export const makeHtmlResponse = () =>
	({
		ok: true,
		headers: {
			get: (name: string) => (name.toLowerCase() === "content-type" ? "text/html" : null),
		},
		blob: () => Promise.resolve(new Blob(["<html>"])),
	}) as unknown as Response;

/** Lets the fire-and-forget warm chain settle. */
export const flushBlobCache = async (): Promise<void> => {
	for (let tick = 0; tick < 6; tick += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
};
