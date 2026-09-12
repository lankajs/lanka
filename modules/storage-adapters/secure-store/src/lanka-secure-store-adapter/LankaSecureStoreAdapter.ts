import type { ILankaStorageAdapter } from "lanka/storage";
import type { ILankaSecureStoreEngine } from "../_interfaces/ILankaSecureStoreEngine";
import { fromKeychainKey, toKeychainKey } from "../_utils/keychain-key-codec/keychainKeyCodec";

/**
 * The row this adapter keeps for itself, and the only one that is not a caller's.
 *
 * Named so that a developer reading the device's keychain can tell what it is.
 */
const INDEX_KEY = "lanka.secure-store.index";

/**
 * What every caller's key is prefixed with, and why the index is safe.
 *
 * Without it an application writing the key `lanka.secure-store.index` writes
 * over the index — legally, with a key it is entitled to use — and every secret
 * stored before that moment becomes invisible to `clear()`. A sign-out then
 * reports success and leaves them on the device.
 *
 * The prefix puts every caller row in a space of its own, and the index outside
 * it. No key a caller can write encodes to something starting with `row.`
 * without going through here first, so the collision is not defended against —
 * it is unreachable.
 */
const ROW_PREFIX = "row.";

/** What a keychain will hold in one row, in bytes. iOS has refused more. */
const MAX_VALUE_BYTES = 2048;

/**
 * The keychain behind `ILankaStorageAdapter`.
 *
 * `expo-secure-store` publishes three calls: read a key, write a key, delete a
 * key. The port asks for two more — empty everything, say what is held — and
 * both of them are what a sign-out needs. This adapter is where that difference
 * is paid, once, instead of in every application that reaches for a keychain.
 *
 * ## The index
 *
 * A row of this adapter's own, holding the keychain keys it has written — the
 * ENCODED spelling, so the index says what is actually in the keychain and
 * `keys()` decodes on the way out. Every write updates it, which is one extra
 * keychain call per operation. That is the price
 * of `clear()` being TRUE: without it a sign-out could only delete keys the
 * caller happened to name, and a token nobody remembered would outlive the
 * session that created it.
 *
 * It is read from the engine on each mutation rather than cached, so a second
 * adapter over the same keychain — a per-tenant instance, a test — sees what the
 * first one wrote.
 *
 * ## Why every write goes through a queue
 *
 * Read-modify-write is not safe to overlap, and overlapping is ordinary: an
 * application storing an access token and a refresh token writes
 * `Promise.all([...])` without a second thought. Both calls then read the same
 * index, and the second publishes it without the first — so `keys()` forgets a
 * key and `clear()` leaves that secret on the device, under a name nobody will
 * think to look for.
 *
 * So writes are serialised per adapter. It costs concurrency a keychain never
 * had — these are milliseconds, on a store holding a handful of secrets — and it
 * buys the one promise that has no second chance.
 *
 * A failure does not poison the queue: the calls behind a rejected one still
 * run, because the alternative is one refused write disabling sign-out.
 *
 * Two adapters over one keychain at the same instant is still not covered, and
 * on a device there is one process.
 *
 * ## The index is written BEFORE the value
 *
 * Between the two writes anything can happen — a locked keychain, a full disk, a
 * process killed. In one order the survivor is a row the index cannot name,
 * which outlives every sign-out. In the other it is a name with no row, which
 * reads as a missing key and which `clear()` deletes harmlessly. The second
 * failure is the one to prefer, so `keys()` may briefly over-report and a secret
 * is never left behind.
 *
 * ## Why values are refused rather than split
 *
 * Above the ceiling the adapter rejects. Splitting a value across rows would
 * make this a filesystem with a keychain underneath, and the failure that hides
 * — half a token read back as a whole one — is worse than the one it prevents.
 * A session token fits; a value that does not belongs somewhere else.
 */
export class LankaSecureStoreAdapter implements ILankaStorageAdapter {
	private readonly engine: ILankaSecureStoreEngine;

	/** A caller's key, as the keychain holds it. */
	private static toRow(key: string): string {
		return `${ROW_PREFIX}${toKeychainKey(key)}`;
	}

	/** A row of this adapter's, back in the spelling the caller wrote. */
	private static fromRow(row: string): string {
		return fromKeychainKey(row.slice(ROW_PREFIX.length));
	}

	/** The tail of the write queue; every mutation waits for the one before it. */
	private work: Promise<unknown> = Promise.resolve();

	public constructor(engine: ILankaSecureStoreEngine) {
		this.engine = engine;
	}

	/**
	 * Runs one mutation at a time, and lets a failure out without stopping the rest.
	 *
	 * The caller gets the real promise — a refused write still rejects at the call
	 * site. What the queue keeps is a version that cannot reject, so the steps
	 * behind it are not cancelled by somebody else's failure.
	 */
	private queue<TResult>(step: () => Promise<TResult>): Promise<TResult> {
		const done = this.work.then(step);
		this.work = done.catch(() => undefined);

		return done;
	}

	private async readIndex(): Promise<string[]> {
		const raw = await this.engine.getItemAsync(INDEX_KEY);
		if (raw === null) return [];

		// A keychain a previous version of an application wrote into can hold
		// anything under this name. Unreadable is treated as empty rather than
		// throwing on every call afterwards: the worst case is a `clear()` that
		// misses rows nobody can name any more.
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed.filter((one) => typeof one === "string") : [];
		} catch {
			return [];
		}
	}

	private async writeIndex(keys: readonly string[]): Promise<void> {
		await this.engine.setItemAsync(INDEX_KEY, JSON.stringify(keys));
	}

	public async getItem(key: string): Promise<string | null> {
		return await this.engine.getItemAsync(LankaSecureStoreAdapter.toRow(key));
	}

	public async setItem(key: string, value: string): Promise<void> {
		const size = new TextEncoder().encode(value).length;
		if (size > MAX_VALUE_BYTES) {
			throw new Error(
				`This value is ${String(size)} bytes and a keychain row holds about ` +
					`${String(MAX_VALUE_BYTES)}. Store it elsewhere and keep its address here — ` +
					"a value truncated by the platform reads back as a whole one.",
			);
		}

		const encoded = LankaSecureStoreAdapter.toRow(key);

		return await this.queue(async () => {
			const index = await this.readIndex();
			// Written once however many times the key is: clause 6 says `keys()`
			// answers what was written, not how often.
			if (!index.includes(encoded)) await this.writeIndex([...index, encoded]);

			await this.engine.setItemAsync(encoded, value);
		});
	}

	public async removeItem(key: string): Promise<void> {
		const encoded = LankaSecureStoreAdapter.toRow(key);

		return await this.queue(async () => {
			// The row first here, and the name second: the surviving failure is again
			// a name with no row rather than a row with no name.
			await this.engine.deleteItemAsync(encoded);

			const index = await this.readIndex();
			if (index.includes(encoded))
				await this.writeIndex(index.filter((one) => one !== encoded));
		});
	}

	public async clear(): Promise<void> {
		// In the queue like every other mutation, so a write that is halfway through
		// cannot land after the wipe has passed its key.
		return await this.queue(async () => {
			// Reads the index rather than the keychain, because the keychain cannot be
			// read: this empties what THIS adapter wrote and leaves rows belonging to
			// the rest of the application alone.
			//
			// Every entry is deleted as written, prefix or not. An entry this version
			// would not have produced is still more likely to be a row of ours than
			// somebody else's, and the cost of being wrong is a delete that finds
			// nothing — against a secret that outlives the sign-out.
			for (const encoded of await this.readIndex()) {
				await this.engine.deleteItemAsync(encoded);
			}

			await this.engine.deleteItemAsync(INDEX_KEY);
		});
	}

	/**
	 * What this adapter wrote, in the spelling it was written with.
	 *
	 * The index holds keychain keys, so this is where clause 11 is actually kept:
	 * a caller that wrote `"with space"` is answered `"with space"` and never the
	 * `row.with_0020space` the keychain has underneath.
	 *
	 * An entry without the prefix is not a key this adapter can name, so it is not
	 * reported. `clear()` still deletes it — being listed and being wiped are
	 * different promises, and only one of them is about spelling.
	 */
	public async keys(): Promise<string[]> {
		return (await this.readIndex())
			.filter((row) => row.startsWith(ROW_PREFIX))
			.map((row) => LankaSecureStoreAdapter.fromRow(row));
	}
}
