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
	 * A driver may answer a `Buffer`, a `Uint8Array` or whatever it held —
	 * `getItemRaw` promises only that nothing was PARSED. The port promises a
	 * string, so anything that is not one is decoded here rather than handed on
	 * as a type the caller was not told about.
	 */
	public async getItem(key: string): Promise<string | null> {
		const raw = await this.engine.getItemRaw(toDriverKey(key));

		if (raw === null || raw === undefined) return null;
		if (typeof raw === "string") return raw;

		return new TextDecoder().decode(raw as ArrayBufferView);
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
