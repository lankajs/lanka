/** A registry snapshot: what goes into persistence and comes back. */
export interface ILankaIdRegistrySnapshot {
	nextId: number;
	entries: [number, string][];
}

/** Where the registry stores mappings so they survive a reload. */
export interface ILankaIdRegistryPersist {
	save: (snapshot: ILankaIdRegistrySnapshot) => Promise<void>;
	load: () => Promise<ILankaIdRegistrySnapshot | null>;
}

export interface ILankaIdRegistryOptions {
	/** Which number to start from. Defaults to 1. */
	startId?: number;
	/** Persistence. Without it the registry lives until the page reloads. */
	persist?: ILankaIdRegistryPersist;
}

/**
 * A string ↔ short id registry.
 *
 * ## Not a hasher
 *
 * Nothing is hashed: an id comes from a counter and is STORED, not computed.
 * Without the stored mapping the number means nothing, which is why the registry
 * has persistence and a hash could not.
 *
 * ## An instance, not statics
 *
 * With static state two registries cannot exist in one process: a second
 * consumer silently shares mappings with the first. For an application that is
 * invisible until the second appears; for a package a second consumer is normal.
 */
export class LankaIdRegistry {
	private readonly stringToId = new Map<string, number>();
	private readonly idToString = new Map<number, string>();
	private readonly persist?: ILankaIdRegistryPersist;
	private nextId: number;

	public constructor(options?: ILankaIdRegistryOptions) {
		// Compared against `undefined` rather than truthiness: `startId: 0` is a
		// legal start, and a truthiness check silently replaces it with one.
		this.nextId = options?.startId !== undefined ? options.startId : 1;
		this.persist = options?.persist;
	}

	/** Restores persisted mappings. A no-op without persistence. */
	public async restore(): Promise<void> {
		if (!this.persist) return;
		const snapshot = await this.persist.load();
		if (!snapshot) return;

		this.nextId = snapshot.nextId;
		for (const [id, value] of snapshot.entries) {
			this.idToString.set(id, value);
			this.stringToId.set(value, id);
		}
	}

	/** Assigns an id to a string, the same one on every call. */
	public async encode(value: string): Promise<number> {
		// `has`, not truthiness: an id of 0 is an ordinary id, and a truthiness
		// check would mint a second one, leaving two records for one string.
		const existing = this.stringToId.get(value);
		if (existing !== undefined) return existing;

		const id = this.nextId;
		this.nextId += 1;
		this.stringToId.set(value, id);
		this.idToString.set(id, value);
		await this.persistSnapshot();
		return id;
	}

	/** Reads a string by id. `null` when the registry never issued that mapping. */
	public decode(id: number): string | null {
		return this.idToString.get(id) ?? null;
	}

	/** A snapshot for persistence, or for handing to a second registry. */
	public getSnapshot(): ILankaIdRegistrySnapshot {
		return {
			nextId: this.nextId,
			entries: [...this.idToString.entries()],
		};
	}

	private async persistSnapshot(): Promise<void> {
		if (!this.persist) return;
		await this.persist.save(this.getSnapshot());
	}
}
