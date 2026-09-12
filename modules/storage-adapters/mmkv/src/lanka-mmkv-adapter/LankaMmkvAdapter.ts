import type { ILankaStorageAdapter } from "lanka/storage";
import type { ILankaMmkvEngine } from "../_interfaces/ILankaMmkvEngine";

/**
 * MMKV behind `ILankaStorageAdapter`, both halves.
 *
 * The only engine on a device that answers WITHOUT awaiting, which is the whole
 * reason to reach for it: a persisted store read during the first render either
 * has its value or it does not. An engine that must be awaited renders once
 * without the value and again with it, and a user reads that as a flash rather
 * than as a load.
 *
 * The asynchronous half is the synchronous one wrapped in a resolved promise.
 * That is not a shortcut — MMKV has nothing to await — and it is what lets a
 * ViewModel written against the port run over this engine without knowing.
 *
 * ```ts
 * const storage = new LankaStorage({ local: createLankaMmkvAdapter(new MMKV()) });
 * ```
 */
export class LankaMmkvAdapter implements ILankaStorageAdapter {
	private readonly engine: ILankaMmkvEngine;

	public constructor(engine: ILankaMmkvEngine) {
		this.engine = engine;
	}

	/**
	 * The one method whose name changed between majors.
	 *
	 * v4 renamed `.delete()` to `.remove()`. Asked of the instance rather than
	 * resolved from a version, because the version in `package.json` is what the
	 * consumer WROTE and the instance is what they got.
	 *
	 * An engine carrying neither is a programming error and says so here, rather
	 * than removing nothing and letting a sign-out look successful.
	 */
	private removeFromEngine(key: string): void {
		if (typeof this.engine.remove === "function") {
			this.engine.remove(key);
			return;
		}
		if (typeof this.engine.delete === "function") {
			this.engine.delete(key);
			return;
		}

		throw new Error(
			"This MMKV instance has neither `remove` (v4) nor `delete` (v3). " +
				"`@lankajs/mmkv` takes an MMKV instance; check what was passed in.",
		);
	}

	public getItemSync(key: string): string | null {
		// `?? null` and not `|| null`: an empty string is a value, and clause 1 of
		// the port says it comes back as one.
		return this.engine.getString(key) ?? null;
	}

	public setItemSync(key: string, value: string): void {
		this.engine.set(key, value);
	}

	public removeItemSync(key: string): void {
		this.removeFromEngine(key);
	}

	public clearSync(): void {
		this.engine.clearAll();
	}

	public getItem(key: string): Promise<string | null> {
		return Promise.resolve(this.getItemSync(key));
	}

	public setItem(key: string, value: string): Promise<void> {
		this.setItemSync(key, value);
		return Promise.resolve();
	}

	public removeItem(key: string): Promise<void> {
		this.removeItemSync(key);
		return Promise.resolve();
	}

	public clear(): Promise<void> {
		this.clearSync();
		return Promise.resolve();
	}

	public keys(): Promise<string[]> {
		return Promise.resolve(this.engine.getAllKeys());
	}
}
