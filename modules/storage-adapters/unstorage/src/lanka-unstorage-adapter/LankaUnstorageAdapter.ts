import type { ILankaStorageAdapter } from "lanka/storage";
import type { ILankaUnstorageEngine } from "../_interfaces/ILankaUnstorageEngine";
import { fromDriverKey, toDriverKey } from "../_utils/driver-key-codec/driverKeyCodec";

/**
 * unstorage behind `ILankaStorageAdapter` — and with it twenty-odd drivers.
 *
 * The other three members are one engine each: a device's fast store, a device's
 * keychain, the bridge an application already had. This one is a filesystem, a
 * Redis, a Cloudflare KV, a Vercel KV, a Netlify blob store, a Mongo, an SQL
 * table, the browser's own — and anything this repository has never heard of,
 * because an application that needs one writes an unstorage driver and keeps the
 * port.
 *
 * It is also the only member that runs on a server, which is what lets
 * `@lankajs/host/server` persist anything at all.
 *
 * ```ts
 * import { createStorage } from "unstorage";
 * import fsDriver from "unstorage/drivers/fs";
 *
 * const adapter = createLankaUnstorageAdapter(createStorage({ driver: fsDriver({ base: "./data" }) }));
 * ```
 */
export class LankaUnstorageAdapter implements ILankaStorageAdapter {
	private readonly engine: ILankaUnstorageEngine;

	public constructor(engine: ILankaUnstorageEngine) {
		this.engine = engine;
	}

	/**
	 * The raw read, and the one line that makes this a string store.
	 *
	 * A driver may answer a `Buffer` or a `Uint8Array` — `getItemRaw` promises
	 * only that nothing was PARSED, and a filesystem answers bytes. Those are a
	 * raw read of a string, and are decoded.
	 *
	 * Anything else is a value this adapter did not write. An application calling
	 * unstorage's own `setItem` beside it leaves rows holding objects and numbers,
	 * because that call serialises — and there is no honest string to make from
	 * `{ a: 1 }`. So the read refuses and names the key, rather than letting a
	 * `TypeError` out of a decoder the caller never invoked, about a row they
	 * cannot place.
	 */
	public async getItem(key: string): Promise<string | null> {
		const raw = await this.engine.getItemRaw(toDriverKey(key));

		if (raw === null || raw === undefined) return null;
		if (typeof raw === "string") return raw;
		if (ArrayBuffer.isView(raw)) return new TextDecoder().decode(raw);

		throw new Error(
			`The row at "${key}" holds a ${typeof raw} rather than a string, so ` +
				"`@lankajs/unstorage` did not write it. Something is calling " +
				"unstorage's own `setItem` on this storage — that call serialises, and " +
				"the two meanings cannot share a key.",
		);
	}

	public setItem(key: string, value: string): Promise<void> {
		return this.engine.setItemRaw(toDriverKey(key), value);
	}

	public removeItem(key: string): Promise<void> {
		return this.engine.removeItem(toDriverKey(key));
	}

	public clear(): Promise<void> {
		return this.engine.clear();
	}

	/**
	 * The keys of the storage, in the spelling they were written with.
	 *
	 * unstorage's keys are paths, so it normalises separators: `a/b` is answered
	 * as `a:b`, a backslash is dropped, and `a::b` collapses. Clause 11 says a key
	 * comes back as it was given, so those three are escaped on the way in and
	 * decoded here — see `driverKeyCodec`, which carries the measurement.
	 */
	public async keys(): Promise<string[]> {
		return (await this.engine.getKeys()).map(fromDriverKey);
	}
}
