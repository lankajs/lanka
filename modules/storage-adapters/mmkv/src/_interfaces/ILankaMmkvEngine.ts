/**
 * The part of MMKV's surface this adapter uses, declared rather than imported.
 *
 * A native module cannot run in node, so an adapter that imported the library
 * could only be tested by the application that shipped it. Declaring the shape
 * here does three things at once: the package has no runtime dependency on the
 * vendor, the conformance suite runs against a double, and the double is a
 * statement — checked by the compiler at every call site — of what the library
 * is believed to offer.
 *
 * ## Why the delete is two optional methods
 *
 * `react-native-mmkv` v4 moved to Nitro and renamed `.delete()` to `.remove()`.
 * Both majors are in production, and a version range in `package.json` would be
 * a guess about what the consumer installed. Asking the instance is an answer
 * about what it actually is.
 *
 * Neither is required here because neither is present in both versions. The
 * adapter refuses an engine carrying neither, loudly, at the moment it is asked
 * to remove something.
 */
export interface ILankaMmkvEngine {
	/** MMKV answers `undefined` for a key it does not hold; the port answers `null`. */
	getString(key: string): string | undefined;
	set(key: string, value: string): void;
	clearAll(): void;
	getAllKeys(): string[];
	/** v3 and earlier. */
	delete?(key: string): void;
	/** v4, under Nitro. */
	remove?(key: string): void;
}
