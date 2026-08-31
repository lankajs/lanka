import { describe, expect, it, vi } from "vitest";
import { LankaIndexedDbAdapter, type ILankaBlobRecord } from "./LankaIndexedDbAdapter";

/**
 * jsdom has no IndexedDB, and pulling in a whole fake implementation for one
 * adapter is deliberately avoided.
 *
 * The connection factory is injected, so a minimal fake covering exactly the
 * surface the adapter uses is enough. It also allows driving the failure paths —
 * an open error, a blocked upgrade, a version change — that a real IndexedDB
 * will not reproduce on demand.
 */

interface IFakeStoreState {
	records: Map<string, ILankaBlobRecord>;
	created: boolean;
	indexNames: string[];
}

const makeFakeFactory = (
	options: {
		failOpen?: boolean;
		blockOpen?: boolean;
		hangOpen?: boolean;
	} = {},
) => {
	const state: IFakeStoreState = {
		records: new Map(),
		created: false,
		indexNames: [],
	};
	let openCalls = 0;

	const makeRequest = <T>(result: T) => {
		const request = {
			result,
			error: null as Error | null,
			onsuccess: null as (() => void) | null,
			onerror: null as (() => void) | null,
		};
		// A real IndexedDB fires callbacks asynchronously; the fake mirrors that, or
		// the adapter's promise wrapping would be verified dishonestly.
		setTimeout(() => request.onsuccess?.(), 0);
		return request as unknown as IDBRequest<T>;
	};

	const makeObjectStore = () =>
		({
			get: (key: string) => makeRequest(state.records.get(key)),
			put: (record: ILankaBlobRecord) => {
				state.records.set(record.key, record);
				return makeRequest(record.key);
			},
			delete: (key: string) => {
				state.records.delete(key);
				return makeRequest(undefined);
			},
			clear: () => {
				state.records.clear();
				return makeRequest(undefined);
			},
			createIndex: (name: string) => {
				state.indexNames.push(name);
			},
			index: () => ({
				getAll: () =>
					makeRequest(
						[...state.records.values()].sort(
							(left, right) => left.lastUsedAt - right.lastUsedAt,
						),
					),
			}),
		}) as unknown as IDBObjectStore;

	const database = {
		objectStoreNames: {
			contains: () => state.created,
		},
		createObjectStore: () => {
			state.created = true;
			return makeObjectStore();
		},
		transaction: () => ({
			objectStore: () => makeObjectStore(),
		}),
		close: vi.fn(),
		onversionchange: null as (() => void) | null,
	} as unknown as IDBDatabase;

	const factory = {
		open: () => {
			openCalls += 1;
			const request = {
				result: database,
				error: options.failOpen ? new Error("open denied") : null,
				onsuccess: null as (() => void) | null,
				onerror: null as (() => void) | null,
				onupgradeneeded: null as (() => void) | null,
				onblocked: null as (() => void) | null,
			};

			if (!options.hangOpen) {
				setTimeout(() => {
					if (options.failOpen) {
						request.onerror?.();
						return;
					}
					if (options.blockOpen) {
						request.onblocked?.();
						return;
					}
					request.onupgradeneeded?.();
					request.onsuccess?.();
				}, 0);
			}

			return request as unknown as IDBOpenDBRequest;
		},
	} as unknown as IDBFactory;

	return {
		factory,
		state,
		database,
		openCalls: () => openCalls,
	};
};

const record = (key: string, lastUsedAt: number): ILankaBlobRecord => ({
	key,
	blob: new Blob([new Uint8Array(4)]),
	lastUsedAt,
	size: 4,
});

describe("LankaIndexedDbAdapter", () => {
	it("creates the object store and its lastUsedAt index on upgrade", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);

		await adapter.put(record("a", 1));

		expect(fake.state.created).toBe(true);
		expect(fake.state.indexNames).toContain("lastUsedAt");
	});

	it("round-trips a blob record", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);

		await adapter.put(record("a", 1));

		expect((await adapter.get("a"))?.key).toBe("a");
	});

	it("returns null for a missing key rather than undefined", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);

		expect(await adapter.get("nope")).toBeNull();
	});

	it("deletes a record", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);
		await adapter.put(record("a", 1));

		await adapter.delete("a");

		expect(await adapter.get("a")).toBeNull();
	});

	it("clears the store", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);
		await adapter.put(record("a", 1));
		await adapter.put(record("b", 2));

		await adapter.clear();

		expect(await adapter.listByAge()).toHaveLength(0);
	});

	it("lists records oldest first, so callers can evict from the head", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);
		await adapter.put(record("new", 100));
		await adapter.put(record("old", 1));
		await adapter.put(record("mid", 50));

		const keys = (await adapter.listByAge()).map((entry) => entry.key);

		expect(keys).toEqual(["old", "mid", "new"]);
	});

	it("reuses a single connection across operations", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);

		await adapter.put(record("a", 1));
		await adapter.get("a");
		await adapter.delete("a");

		expect(fake.openCalls()).toBe(1);
	});

	it("rejects when the database cannot be opened", async () => {
		const fake = makeFakeFactory({ failOpen: true });
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);

		await expect(adapter.get("a")).rejects.toThrow("open denied");
	});

	it("rejects when an upgrade is blocked by another connection", async () => {
		const fake = makeFakeFactory({ blockOpen: true });
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);

		await expect(adapter.get("a")).rejects.toThrow(/blocked/i);
	});

	it("does not cache a failed connection — the next call retries", async () => {
		const fake = makeFakeFactory({ failOpen: true });
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);

		await expect(adapter.get("a")).rejects.toThrow();
		await expect(adapter.get("a")).rejects.toThrow();

		// A memoised rejected promise would fail the second call without trying, and
		// one transient error would kill the cache permanently.
		expect(fake.openCalls()).toBe(2);
	});

	it("closes its handle when another process upgrades the schema", async () => {
		const fake = makeFakeFactory();
		const adapter = new LankaIndexedDbAdapter(fake.factory, "db", 1);
		await adapter.put(record("a", 1));

		// A WebView can run in more than one process.
		fake.database.onversionchange?.(new Event("versionchange") as never);

		expect(fake.database.close).toHaveBeenCalled();
	});
});
