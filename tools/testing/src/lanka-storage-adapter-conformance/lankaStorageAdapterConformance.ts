import { describe, expect, it } from "vitest";
import type { ILankaStorageAdapter } from "lanka/storage";

/**
 * What every storage adapter must DO, asserted once for everyone who writes one.
 *
 * ## Why this is not each package's own test file
 *
 * `ILankaStorageAdapter` is four operations and two of them are `set` and `get`.
 * Signatures are not where two honest adapters differ. They differ on whether an
 * empty string survives the round trip, on whether `clear()` reaches keys the
 * engine cannot enumerate, on whether a value too large is refused or silently
 * cut. Every one of those is invisible in a type and fatal at four in the
 * morning, because the failure is a token that decrypts to nonsense a week after
 * it was stored.
 *
 * Written per package, the copies diverge — not the day they are written, but
 * the day one gains an assertion and the others do not. The package that then
 * stops keeping the promise has a green suite, which is a check that never asked
 * the question.
 *
 * So the assertions live here. A member of `modules/storage-adapters/` calls
 * this, `@lankajs/storage` calls it for the two adapters it carries over what a
 * browser already provides, and so does an application that wrote its own over an
 * engine this repository never heard of:
 *
 * ```ts
 * lankaStorageAdapterConformance({
 * 	vendor: "my engine",
 * 	create: () => createMyAdapter(engine),
 * 	sync: true,
 * 	maxValueBytes: 2048,
 * });
 * ```
 *
 * A failure names the clause, so what comes back is "clause 1 — returns every
 * value byte for byte", not "expected null to be an empty string".
 *
 * ## Why the scenes are DATA
 *
 * `LANKA_STORAGE_ADAPTER_SCENES` is the list, and this function only hands it to
 * `describe`/`it`. That split is what lets the suite's own spec run a scene
 * against a deliberately BROKEN adapter and assert that it fails: a suite which
 * only ever passes real implementations proves that it agrees with them, not
 * that it checks them.
 *
 * ## What it does not check
 *
 * The three promises the port names as belonging to whoever WIRES an adapter:
 * that the engine is handed in rather than constructed, that an engine which
 * encrypts itself is not encrypted a second time, and that a server keeps one
 * namespace per request. None can be observed from inside an implementation.
 */

/** One implementation's entry into the shared assertions. */
export interface ILankaStorageAdapterConformance {
	/** The implementation's name, as it appears in the test output. */
	vendor: string;
	/**
	 * A fresh adapter over an EMPTY namespace, per scene.
	 *
	 * Most engines are a process-wide singleton — one MMKV instance, one
	 * `localStorage` — so "fresh" usually means the factory empties it. A shared
	 * namespace makes each scene depend on the one before it.
	 */
	create: () => ILankaStorageAdapter;
	/**
	 * Whether this adapter declares the synchronous half. Default: it does not.
	 *
	 * A CLAIM, checked in both directions by clause 8: an adapter that says `true`
	 * and declares three methods fails, and so does one that says nothing and
	 * declares four. The alternative — reading the capability off the adapter —
	 * would make the suite agree with whatever it was given.
	 */
	sync?: boolean;
	/**
	 * The largest value this engine holds, in bytes, when it has a ceiling.
	 *
	 * `expo-secure-store` is the reason: roughly 2 KB, enforced by the platform
	 * and not by the library. Declared, clause 10 requires the adapter to REFUSE
	 * what is over the line; left out, clause 10 requires a large value to
	 * survive intact.
	 */
	maxValueBytes?: number;
}

/** What a scene is told about the adapter it was handed. */
export interface ILankaStorageAdapterContext {
	sync: boolean;
	maxValueBytes?: number;
}

/** One assertion about the port, runnable on its own. */
export interface ILankaStorageAdapterScene {
	/** The clause of `ILankaStorageAdapter` this holds to account. */
	clause: number;
	/** Which part of the port it is about, for the output. */
	group: string;
	/** Reads as a sentence about the adapter. */
	title: string;
	/** Registered only for an adapter that declares the synchronous half. */
	needsSync?: boolean;
	/** Throws when the adapter breaks the clause. */
	check: (
		create: () => ILankaStorageAdapter,
		context: ILankaStorageAdapterContext,
	) => Promise<void>;
}

const KEY = "lanka.conformance.token";
const OTHER = "lanka.conformance.profile";
const THIRD = "lanka.conformance.locale";

/**
 * The values an engine is most likely to mangle, and none of them exotic.
 *
 * Each one is a string a real application stores. What they have in common is
 * that an engine which serialises on the way in and parses on the way out
 * answers something that is not a string for at least one of them — which is the
 * whole of clause 1, and the trap `unstorage`'s default `getItem` falls into.
 */
export const LANKA_STORAGE_LITERALS: readonly string[] = Object.freeze([
	"",
	"null",
	"undefined",
	"true",
	"0",
	"{}",
	"[]",
	'{"id":1}',
	"[1,2,3]",
	"  padded  ",
	"two\nlines",
	"🔐 naïve café",
]);

/**
 * Keys an engine is most likely to rewrite underneath the caller.
 *
 * Cache Storage resolves a key as a URL, `expo-secure-store` allows only
 * letters, digits and three punctuation marks, and a prefixing adapter joins
 * strings. All three are ways of answering a key nobody wrote.
 */
const AWKWARD_KEYS: readonly string[] = Object.freeze([
	"with space",
	"with/slash",
	"with:colon",
	"with?query=1",
	"dotted.key.parts",
	"UPPER_and_lower",
	"-leading-dash",
	"naïve-café",
]);

/** The four methods that make up the synchronous half. */
const SYNC_METHODS = ["getItemSync", "setItemSync", "removeItemSync", "clearSync"] as const;

const declaredSyncMethods = (adapter: ILankaStorageAdapter): string[] =>
	SYNC_METHODS.filter((name) => typeof adapter[name] === "function");

/**
 * Narrows an adapter to one with the synchronous half, for the scenes that need it.
 *
 * Clause 8 is what proves the narrowing is safe — it runs for every adapter, and
 * a partial declaration fails there before these scenes are reached.
 */
const withSync = (adapter: ILankaStorageAdapter) =>
	adapter as ILankaStorageAdapter &
		Required<Pick<ILankaStorageAdapter, "getItemSync">> & {
			setItemSync: (key: string, value: string) => void;
			removeItemSync: (key: string) => void;
			clearSync: () => void;
		};

/** Everything the port promises, as a list a runner can walk. */
export const LANKA_STORAGE_ADAPTER_SCENES: readonly ILankaStorageAdapterScene[] = [
	{
		clause: 1,
		group: "values",
		title: "returns every value byte for byte, including the ones that look like JSON",
		check: async (create) => {
			const adapter = create();

			for (const [index, value] of LANKA_STORAGE_LITERALS.entries()) {
				const key = `${KEY}.${String(index)}`;
				await adapter.setItem(key, value);

				expect(await adapter.getItem(key), `the value ${JSON.stringify(value)}`).toBe(
					value,
				);
			}
		},
	},
	{
		clause: 1,
		group: "values",
		title: "keeps an empty string apart from a key that was never written",
		check: async (create) => {
			const adapter = create();
			await adapter.setItem(KEY, "");

			expect(await adapter.getItem(KEY), "a stored empty string").toBe("");
			expect(await adapter.getItem(OTHER), "a key nobody wrote").toBeNull();
		},
	},
	{
		clause: 1,
		group: "values",
		title: "overwrites a value with an empty string",
		check: async (create) => {
			const adapter = create();
			await adapter.setItem(KEY, "something");
			// The shape a guarded write falls into — `if (!value) return remove(key)`
			// — which turns "the user cleared this field" into "the user never had
			// one", and the difference shows up as a stale value on the next read.
			await adapter.setItem(KEY, "");

			expect(await adapter.getItem(KEY)).toBe("");
		},
	},
	{
		clause: 4,
		group: "values",
		title: "replaces a value rather than merging into it",
		check: async (create) => {
			const adapter = create();
			await adapter.setItem(KEY, '{"a":1}');
			await adapter.setItem(KEY, '{"b":2}');

			expect(await adapter.getItem(KEY)).toBe('{"b":2}');
		},
	},
	{
		clause: 2,
		group: "absence",
		title: "answers null for a key it never had, rather than undefined",
		check: async (create) => {
			const adapter = create();

			expect(await adapter.getItem(KEY)).toBeNull();
		},
	},
	{
		clause: 2,
		group: "absence",
		title: "answers null once the key is removed",
		check: async (create) => {
			const adapter = create();
			await adapter.setItem(KEY, "kept");
			await adapter.removeItem(KEY);

			expect(await adapter.getItem(KEY)).toBeNull();
		},
	},
	{
		clause: 2,
		group: "absence",
		title: "answers null after a clear, rather than an empty value",
		check: async (create) => {
			const adapter = create();
			await adapter.setItem(KEY, "before the sign-out");
			await adapter.clear();

			// `null` and `""` are different answers, and a session check written as
			// `if (token !== null)` believes a signed-out user is signed in.
			expect(await adapter.getItem(KEY)).toBeNull();
		},
	},
	{
		clause: 3,
		group: "absence",
		title: "removes a key it does not have without failing",
		check: async (create) => {
			const adapter = create();

			await expect(
				adapter.removeItem("lanka.conformance.never-written"),
			).resolves.toBeUndefined();
		},
	},
	{
		clause: 5,
		group: "the namespace",
		title: "empties every key it wrote",
		check: async (create) => {
			const adapter = create();
			await adapter.setItem(KEY, "a");
			await adapter.setItem(OTHER, "b");
			await adapter.setItem(THIRD, "c");

			await adapter.clear();

			expect(await adapter.getItem(KEY)).toBeNull();
			expect(await adapter.getItem(OTHER)).toBeNull();
			expect(await adapter.getItem(THIRD)).toBeNull();
		},
	},
	{
		clause: 7,
		group: "the namespace",
		title: "empties what it wrote even when the engine cannot enumerate",
		check: async (create) => {
			const adapter = create();
			await adapter.setItem(KEY, "a");
			await adapter.setItem(OTHER, "b");

			await adapter.clear();
			// The clause exists for `expo-secure-store`, which deletes a key it is
			// handed and offers nothing else. Such an adapter keeps its own index, and
			// this is the scene that says the index is actually consulted.
			await adapter.setItem(THIRD, "c");
			await adapter.clear();

			expect(await adapter.getItem(THIRD)).toBeNull();
			if (adapter.keys) expect(await adapter.keys()).toEqual([]);
		},
	},
	{
		clause: 5,
		group: "the namespace",
		title: "empties a store that is already empty",
		check: async (create) => {
			const adapter = create();

			// Sign-out runs on a session that may never have written anything, and an
			// adapter keeping an index has nothing to read at that moment.
			await expect(adapter.clear()).resolves.toBeUndefined();
			await expect(adapter.clear()).resolves.toBeUndefined();
		},
	},
	{
		clause: 6,
		group: "the namespace",
		title: "answers no keys for an empty store, its bookkeeping included",
		check: async (create) => {
			const adapter = create();
			if (!adapter.keys) return;

			expect(await adapter.keys(), "before anything was written").toEqual([]);

			await adapter.setItem(KEY, "a");
			await adapter.clear();

			expect(await adapter.keys(), "after a clear").toEqual([]);
		},
	},
	{
		clause: 6,
		group: "the namespace",
		title: "counts a key once, however many times it was written",
		check: async (create) => {
			const adapter = create();
			if (!adapter.keys) return;

			await adapter.setItem(KEY, "first");
			await adapter.setItem(KEY, "second");

			expect(await adapter.keys()).toEqual([KEY]);
		},
	},
	{
		clause: 11,
		group: "the namespace",
		title: "uses a key as it was given, punctuation and all",
		check: async (create) => {
			const adapter = create();

			for (const key of AWKWARD_KEYS) {
				await adapter.setItem(key, `value for ${key}`);
			}

			for (const key of AWKWARD_KEYS) {
				expect(await adapter.getItem(key), `the key ${JSON.stringify(key)}`).toBe(
					`value for ${key}`,
				);
			}

			if (adapter.keys) {
				// The spelling matters as much as the value: an adapter that encodes a
				// key to satisfy its engine has to decode it again here, or a caller
				// clearing "everything under this prefix" reads a key it never wrote.
				expect([...(await adapter.keys())].sort()).toEqual([...AWKWARD_KEYS].sort());
			}

			await adapter.removeItem("with space");

			expect(await adapter.getItem("with space"), "the one that was removed").toBeNull();
			expect(await adapter.getItem("with/slash"), "its neighbour").toBe(
				"value for with/slash",
			);
		},
	},
	{
		clause: 6,
		group: "the namespace",
		title: "lists exactly the keys it wrote, when it lists at all",
		check: async (create) => {
			const adapter = create();
			// An optional member has nothing to hold to account when it is absent.
			// Clause 7 is what covers the adapters that land here.
			if (!adapter.keys) return;

			await adapter.setItem(KEY, "a");
			await adapter.setItem(OTHER, "b");

			expect([...(await adapter.keys())].sort()).toEqual([KEY, OTHER].sort());

			await adapter.removeItem(KEY);

			expect([...(await adapter.keys())]).toEqual([OTHER]);
		},
	},
	{
		clause: 8,
		group: "the synchronous half",
		title: "declares all four synchronous methods, or none",
		check: (create, context) => {
			const declared = declaredSyncMethods(create());

			expect(
				declared.length === 0 || declared.length === SYNC_METHODS.length,
				`declares ${String(declared.length)} of four: ${declared.join(", ")}`,
			).toBe(true);
			expect(declared.length > 0, "the `sync` this suite was called with").toBe(context.sync);

			return Promise.resolve();
		},
	},
	{
		clause: 9,
		group: "the synchronous half",
		needsSync: true,
		title: "shows a synchronously written value to the asynchronous reader",
		check: async (create) => {
			const adapter = withSync(create());
			adapter.setItemSync(KEY, "written without awaiting");

			expect(await adapter.getItem(KEY)).toBe("written without awaiting");
		},
	},
	{
		clause: 9,
		group: "the synchronous half",
		needsSync: true,
		title: "shows an asynchronously written value to the synchronous reader",
		check: async (create) => {
			const adapter = withSync(create());
			await adapter.setItem(KEY, "written with an await");

			expect(adapter.getItemSync(KEY)).toBe("written with an await");
		},
	},
	{
		clause: 9,
		group: "the synchronous half",
		needsSync: true,
		title: "removes and empties across both halves",
		check: async (create) => {
			const adapter = withSync(create());
			await adapter.setItem(KEY, "a");
			adapter.removeItemSync(KEY);

			expect(await adapter.getItem(KEY)).toBeNull();

			await adapter.setItem(OTHER, "b");
			adapter.clearSync();

			expect(await adapter.getItem(OTHER)).toBeNull();
		},
	},
	{
		clause: 9,
		group: "the synchronous half",
		needsSync: true,
		title: "shows a synchronous clear to the asynchronous enumeration",
		check: async (create) => {
			const adapter = withSync(create());
			if (!adapter.keys) return;

			adapter.setItemSync(KEY, "a");

			expect(await adapter.keys(), "written synchronously").toEqual([KEY]);

			adapter.clearSync();

			expect(await adapter.keys(), "cleared synchronously").toEqual([]);
		},
	},
	{
		clause: 10,
		group: "size",
		title: "refuses a value over the engine's ceiling, or holds a large one intact",
		check: async (create, context) => {
			const adapter = create();

			if (context.maxValueBytes === undefined) {
				// No ceiling declared, so the promise is the other one: a value far
				// larger than anything a token needs survives unchanged. Truncation is
				// what this catches, and truncation never announces itself.
				const large = "x".repeat(64 * 1024);
				await adapter.setItem(KEY, large);

				expect(await adapter.getItem(KEY)).toBe(large);
				return;
			}

			const atTheLimit = "x".repeat(context.maxValueBytes);
			await adapter.setItem(KEY, atTheLimit);

			expect(await adapter.getItem(KEY), "a value exactly at the ceiling").toBe(atTheLimit);

			await expect(
				adapter.setItem(OTHER, "x".repeat(context.maxValueBytes + 1)),
				"a value one byte over the ceiling",
			).rejects.toThrow();
			expect(await adapter.getItem(OTHER), "the refused value").toBeNull();
		},
	},
];

/**
 * Registers the shared scenes against one implementation.
 *
 * Call it inside the package's own spec, so the output says which implementation
 * failed without every title repeating the name.
 */
export const lankaStorageAdapterConformance = ({
	vendor,
	create,
	sync = false,
	maxValueBytes,
}: ILankaStorageAdapterConformance): void => {
	const context: ILankaStorageAdapterContext = { sync, maxValueBytes };
	const scenes = LANKA_STORAGE_ADAPTER_SCENES.filter((scene) => sync || !scene.needsSync);
	const groups = [...new Set(scenes.map((scene) => scene.group))];

	for (const group of groups) {
		describe(`${vendor} — ${group}`, () => {
			for (const scene of scenes.filter((one) => one.group === group)) {
				it(`clause ${String(scene.clause)}: ${scene.title}`, () =>
					scene.check(create, context));
			}
		});
	}
};
