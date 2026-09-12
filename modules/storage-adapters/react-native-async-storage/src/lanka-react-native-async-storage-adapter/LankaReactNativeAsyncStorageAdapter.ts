import type { ILankaStorageAdapter } from "lanka/storage";
import type { ILankaReactNativeAsyncStorageEngine } from "../_interfaces/ILankaReactNativeAsyncStorageEngine";

/**
 * AsyncStorage behind `ILankaStorageAdapter`.
 *
 * The engine an existing React Native application already has installed, and the
 * closest of the four to the port: five calls, five calls, and the same meaning
 * for each. What the adapter is for is the two places where "the same" is not
 * quite true, and one thing the port asks for that the library will not give.
 *
 * **No synchronous half.** Everything AsyncStorage does crosses a bridge, so
 * nothing it answers can arrive before the next tick. A store read during the
 * first render therefore renders once without its value; `@lankajs/mmkv` is the
 * engine for that case, and the two are installed together more often than
 * either is installed alone.
 *
 * ```ts
 * import AsyncStorage from "@react-native-async-storage/async-storage";
 *
 * const storage = new LankaStorage({
 * 	local: createLankaReactNativeAsyncStorageAdapter(AsyncStorage),
 * });
 * ```
 */
export class LankaReactNativeAsyncStorageAdapter implements ILankaStorageAdapter {
	private readonly engine: ILankaReactNativeAsyncStorageEngine;

	public constructor(engine: ILankaReactNativeAsyncStorageEngine) {
		this.engine = engine;
	}

	public getItem(key: string): Promise<string | null> {
		return this.engine.getItem(key);
	}

	public setItem(key: string, value: string): Promise<void> {
		return this.engine.setItem(key, value);
	}

	public removeItem(key: string): Promise<void> {
		return this.engine.removeItem(key);
	}

	/**
	 * Empties the application's whole space, because the library has only one.
	 *
	 * Clause 5 says `clear()` empties this adapter's namespace, and here the
	 * namespace IS everything: AsyncStorage has no notion of one. An application
	 * that needs two spaces gives each its own engine — or its own key prefix,
	 * which is the application's prefix and not this package's to invent.
	 */
	public clear(): Promise<void> {
		return this.engine.clear();
	}

	/**
	 * The library's readonly array, copied.
	 *
	 * The port promises a `string[]`, and a caller sorting the answer in place is
	 * ordinary. Handing out the library's own array would make that either a type
	 * error or, worse, a mutation of whatever the library is holding.
	 */
	public async keys(): Promise<string[]> {
		return [...(await this.engine.getAllKeys())];
	}
}
