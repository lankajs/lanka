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
 * The asynchronous half is the synchronous one, awaited. That is not a shortcut
 * — MMKV has nothing to await — and it is what lets a ViewModel written against
 * the port run over this engine without knowing.
 *
 * Each of those four goes through `settled`, and the difference only shows when
 * the engine REFUSES: a full disk, an encryption key that no longer opens the
 * file. MMKV throws SYNCHRONOUSLY, and a method that promises a `Promise` must
 * hand the failure over the way it promised — `adapter.setItem(...).catch(...)`
 * and `Promise.all([...])` both break on a synchronous throw, and the second
 * breaks before the array is even built.
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

	/**
	 * The synchronous call as a promise, refusal included.
	 *
	 * `Promise.resolve(work())` would let a throw out before the promise exists;
	 * an `async` method with nothing to await says "asynchronous" about work that
	 * is not. The executor is the one form that keeps both true, and it rejects
	 * with EXACTLY what the engine threw rather than a copy of it.
	 */
	private settled<TResult>(work: () => TResult): Promise<TResult> {
		return new Promise<TResult>((resolve) => resolve(work()));
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
		return this.settled(() => this.getItemSync(key));
	}

	public setItem(key: string, value: string): Promise<void> {
		return this.settled(() => this.setItemSync(key, value));
	}

	public removeItem(key: string): Promise<void> {
		return this.settled(() => this.removeItemSync(key));
	}

	public clear(): Promise<void> {
		return this.settled(() => this.clearSync());
	}

	public keys(): Promise<string[]> {
		return this.settled(() => this.engine.getAllKeys());
	}
}
