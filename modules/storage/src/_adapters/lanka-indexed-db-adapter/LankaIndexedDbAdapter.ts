/**
 * A minimal binary store on IndexedDB — the only storage here that holds
 * `Blob`s rather than strings.
 *
 * Not the ordinary `ILankaAsyncStorageAdapter`: its contract returns a string or
 * `null`, which for images would mean base64 — inflating every payload by about a
 * third, costing a `FileReader` pass per image and keeping the decoded copy in
 * memory. Blobs go in and out as-is and the consumer hands the browser an object
 * URL.
 *
 * The connection factory is injected: the adapter is testable without a real
 * IndexedDB (jsdom has none), and a caller can probe availability before relying
 * on it.
 */

export interface ILankaBlobRecord {
	/** Cache key — the image URL. */
	key: string;
	blob: Blob;
	/** Time of the last read or write; eviction goes by it. */
	lastUsedAt: number;
	/** Byte size, denormalised so a size sweep needs no blob reads. */
	size: number;
}

export interface ILankaBlobStoreAdapter {
	get: (key: string) => Promise<ILankaBlobRecord | null>;
	put: (record: ILankaBlobRecord) => Promise<void>;
	delete: (key: string) => Promise<void>;
	/** All records by last use, oldest first. */
	listByAge: () => Promise<ILankaBlobRecord[]>;
	clear: () => Promise<void>;
}

const STORE_NAME = "images";
const LAST_USED_INDEX = "lastUsedAt";

/** Wraps an IndexedDB request in a promise. IndexedDB predates promises. */
const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
	new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
	});

/**
 * IndexedDB, as the binary store `@lankajs/blob-cache` keeps its bytes in.
 *
 * NOT one of `LankaStorage`'s handlers, and not an `ILankaStorageAdapter`: those
 * answer a string or `null`, this one answers a record carrying a `Blob`. The
 * reason is in this file's header, and the conformance suite is what separates
 * them — the two string adapters are run through it and this one cannot be.
 *
 * Published because a caller building the blob cache by hand supplies the store,
 * and this is the one the ambient cache uses.
 */
export class LankaIndexedDbAdapter implements ILankaBlobStoreAdapter {
	private readonly factory: IDBFactory;
	private readonly databaseName: string;
	private readonly version: number;
	private connection: Promise<IDBDatabase> | null = null;

	constructor(factory: IDBFactory, databaseName: string, version = 1) {
		this.factory = factory;
		this.databaseName = databaseName;
		this.version = version;
	}

	public async get(key: string): Promise<ILankaBlobRecord | null> {
		const store = await this.getStore("readonly");
		const record = await requestToPromise(
			store.get(key) as IDBRequest<ILankaBlobRecord | undefined>,
		);
		return record ?? null;
	}

	public async put(record: ILankaBlobRecord): Promise<void> {
		const store = await this.getStore("readwrite");
		await requestToPromise(store.put(record));
	}

	public async delete(key: string): Promise<void> {
		const store = await this.getStore("readwrite");
		await requestToPromise(store.delete(key));
	}

	public async listByAge(): Promise<ILankaBlobRecord[]> {
		const store = await this.getStore("readonly");
		const index = store.index(LAST_USED_INDEX);
		const records = await requestToPromise(index.getAll() as IDBRequest<ILankaBlobRecord[]>);
		// `getAll` on an index yields index order, that is oldest first — exactly
		// the eviction order. Sorted again so a store without the index (an older
		// schema surviving an interrupted upgrade) still behaves.
		return records.slice().sort((left, right) => left.lastUsedAt - right.lastUsedAt);
	}

	public async clear(): Promise<void> {
		const store = await this.getStore("readwrite");
		await requestToPromise(store.clear());
	}

	private openDatabase(): Promise<IDBDatabase> {
		return new Promise<IDBDatabase>((resolve, reject) => {
			const request = this.factory.open(this.databaseName, this.version);

			request.onupgradeneeded = () => {
				const database = request.result;
				if (database.objectStoreNames.contains(STORE_NAME)) return;
				const store = database.createObjectStore(STORE_NAME, {
					keyPath: "key",
				});
				store.createIndex(LAST_USED_INDEX, LAST_USED_INDEX);
			};

			request.onsuccess = () => {
				const database = request.result;
				// Another tab upgraded the schema: drop this handle rather than keep
				// writing through a stale connection.
				database.onversionchange = () => {
					database.close();
					this.connection = null;
				};
				resolve(database);
			};

			request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));

			// In private mode and in some WebViews `open` never settles; the caller's
			// probe applies the deadline, while a blocked upgrade is reported here.
			request.onblocked = () =>
				reject(new Error("IndexedDB open blocked by another connection"));
		});
	}

	private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
		if (!this.connection) {
			this.connection = this.openDatabase();
		}
		let database: IDBDatabase;
		try {
			database = await this.connection;
		} catch (error) {
			// Never cache a failed connection: the next call gets a fresh attempt.
			this.connection = null;
			throw error;
		}
		return database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
	}
}
