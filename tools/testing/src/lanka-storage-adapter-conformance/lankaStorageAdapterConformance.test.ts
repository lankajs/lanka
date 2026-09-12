import { describe, expect, it } from "vitest";
import { createLankaFakeStorageAdapter } from "../_factories/create-lanka-fake-storage-adapter/createLankaFakeStorageAdapter";
import {
	LANKA_STORAGE_ADAPTER_SCENES,
	lankaStorageAdapterConformance,
	type ILankaStorageAdapterContext,
} from "./lankaStorageAdapterConformance";
import type { ILankaStorageAdapter } from "lanka/storage";

/**
 * The suite, checked against adapters that are WRONG on purpose.
 *
 * A suite that passes every real implementation proves only that it agrees with
 * them. What has to be proved is the other direction: that each clause REJECTS
 * the shape it was written against. Below, one broken adapter per clause, each
 * breaking exactly one promise and keeping the rest.
 *
 * Every one of them is a bug somebody has actually shipped — an engine that
 * parses JSON on the way out, a `clear` that empties an index and leaves the
 * values, a ceiling that truncates instead of refusing. None is invented to give
 * a clause something to catch.
 *
 * This is why the scenes are data. A suite that existed only as `describe`/`it`
 * could not be pointed at a broken subject without nesting a runner inside a
 * runner.
 */

/** An adapter that keeps every clause, wrapped so one promise can be broken. */
const broken = (patch: (adapter: ILankaStorageAdapter) => Partial<ILankaStorageAdapter>) => () => {
	const adapter = createLankaFakeStorageAdapter();
	return { ...adapter, ...patch(adapter) } as ILankaStorageAdapter;
};

const SYNC: ILankaStorageAdapterContext = { sync: true };

/** Which clauses failed when the suite was pointed at this adapter. */
const clausesRefused = async (
	create: () => ILankaStorageAdapter,
	context: ILankaStorageAdapterContext = SYNC,
): Promise<number[]> => {
	const refused = new Set<number>();

	for (const scene of LANKA_STORAGE_ADAPTER_SCENES) {
		if (scene.needsSync && !context.sync) continue;

		try {
			await scene.check(create, context);
		} catch {
			refused.add(scene.clause);
		}
	}

	return [...refused].sort((a, b) => a - b);
};

describe("lankaStorageAdapterConformance — what it refuses", () => {
	it("clause 1: an adapter that parses JSON on the way out", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				// `unstorage`'s plain `getItem` does exactly this, which is why its
				// member has to use `getItemRaw` instead.
				getItem: async (key) => {
					const raw = await adapter.getItem(key);
					if (raw === null) return null;
					try {
						return JSON.parse(raw) as string;
					} catch {
						return raw;
					}
				},
			})),
		);

		expect(refused).toContain(1);
	});

	it("clause 2: an adapter that answers undefined for a missing key", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				getItem: async (key) =>
					(await adapter.getItem(key)) ?? (undefined as unknown as null),
			})),
		);

		expect(refused).toContain(2);
	});

	it("clause 3: an adapter that fails on removing what is not there", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				removeItem: async (key) => {
					if ((await adapter.getItem(key)) === null) throw new Error("no such key");
					await adapter.removeItem(key);
				},
			})),
		);

		expect(refused).toContain(3);
	});

	it("clause 4: an adapter whose second write is ignored", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				setItem: async (key, value) => {
					if ((await adapter.getItem(key)) !== null) return;
					await adapter.setItem(key, value);
				},
			})),
		);

		expect(refused).toContain(4);
	});

	it("clause 5: an adapter whose clear does nothing", async () => {
		const refused = await clausesRefused(broken(() => ({ clear: () => Promise.resolve() })));

		expect(refused).toContain(5);
	});

	it("clause 6: an adapter that lists its own bookkeeping key", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				// The shape an adapter keeping a key index falls into: the index is a
				// key too, and a caller clearing "everything this wrote" then hands the
				// engine a key nobody stored.
				keys: async () => [...((await adapter.keys?.()) ?? []), "lanka.index"],
			})),
		);

		expect(refused).toContain(6);
	});

	it("clause 7: an adapter whose index is emptied but never refilled", async () => {
		const refused = await clausesRefused(
			broken((adapter) => {
				let cleared = false;

				return {
					clear: async () => {
						// Clause 5 still passes: the first clear works. What breaks is the
						// SECOND life of the store, which is where a real index bug lives.
						if (cleared) return;
						cleared = true;
						await adapter.clear();
					},
				};
			}),
		);

		expect(refused).toContain(7);
		expect(refused, "the first clear still worked").not.toContain(5);
	});

	it("clause 8: an adapter declaring two of the four synchronous methods", async () => {
		const refused = await clausesRefused(
			broken(() => ({ removeItemSync: undefined, clearSync: undefined })),
		);

		expect(refused).toContain(8);
	});

	it("clause 8: an adapter with no synchronous half that was announced as having one", async () => {
		const refused = await clausesRefused(
			broken(() => ({
				getItemSync: undefined,
				setItemSync: undefined,
				removeItemSync: undefined,
				clearSync: undefined,
			})),
		);

		expect(refused).toContain(8);
	});

	it("clause 9: an adapter whose two halves hold separate stores", async () => {
		const refused = await clausesRefused(
			broken(() => {
				const aside = new Map<string, string>();

				return {
					getItemSync: (key) => aside.get(key) ?? null,
					setItemSync: (key, value) => {
						aside.set(key, value);
					},
					removeItemSync: (key) => {
						aside.delete(key);
					},
					clearSync: () => {
						aside.clear();
					},
				};
			}),
		);

		expect(refused).toContain(9);
	});

	it("clause 1: an adapter that treats an empty value as a removal", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				// The guard that reads as tidiness: "no value, no key". It turns a
				// field the user cleared into a field the user never filled, and the
				// next read answers whatever was there before.
				setItem: (key, value) =>
					value === "" ? adapter.removeItem(key) : adapter.setItem(key, value),
			})),
		);

		expect(refused).toContain(1);
	});

	it("clause 5: an adapter whose clear fails on a store nobody wrote to", async () => {
		const refused = await clausesRefused(
			broken((adapter) => {
				let written = false;

				return {
					setItem: async (key, value) => {
						written = true;
						await adapter.setItem(key, value);
					},
					// The shape an index-keeping adapter falls into: sign-out runs on a
					// session that never stored anything, and the index is not there.
					clear: async () => {
						if (!written) throw new Error("no index to read");
						await adapter.clear();
					},
				};
			}),
		);

		expect(refused).toContain(5);
	});

	it("clause 6: an adapter whose index grows a row per write", async () => {
		const refused = await clausesRefused(
			broken((adapter) => {
				const index: string[] = [];

				return {
					setItem: async (key, value) => {
						index.push(key);
						await adapter.setItem(key, value);
					},
					keys: () => Promise.resolve([...index]),
				};
			}),
		);

		expect(refused).toContain(6);
	});

	it("clause 11: an adapter that encodes keys and forgets to decode them", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				// What `expo-secure-store` will force: its keys may hold only letters,
				// digits and three punctuation marks. Encoding is the right answer;
				// encoding without decoding hands the caller keys it never wrote.
				setItem: (key, value) => adapter.setItem(encodeURIComponent(key), value),
				getItem: (key) => adapter.getItem(encodeURIComponent(key)),
				removeItem: (key) => adapter.removeItem(encodeURIComponent(key)),
			})),
		);

		expect(refused).toContain(11);
	});

	it("clause 10: an adapter that truncates instead of refusing", async () => {
		const refused = await clausesRefused(
			broken((adapter) => ({
				setItem: (key, value) => adapter.setItem(key, value.slice(0, 2048)),
			})),
			{ sync: true, maxValueBytes: 2048 },
		);

		expect(refused).toContain(10);
	});

	it("refuses nothing when the adapter keeps every clause", async () => {
		expect(await clausesRefused(createLankaFakeStorageAdapter)).toEqual([]);
	});
});

/**
 * The double, through the suite it exists to make runnable.
 *
 * It is also the second implementation the port needs: an interface with one
 * implementation is not an abstraction, and every member of
 * `modules/storage-adapters/` is checked against exactly these scenes.
 */
lankaStorageAdapterConformance({
	vendor: "the fake",
	create: createLankaFakeStorageAdapter,
	sync: true,
});

/**
 * The same list over an adapter that declares neither optional capability.
 *
 * `keys()` and the synchronous half are the two things the port lets an engine
 * not have, and `expo-secure-store` will have neither. The scenes behave
 * differently for it — clause 6 has nothing to hold to account, clause 7 checks
 * the wipe without being able to read the keys back — and a suite exercised only
 * over the fully capable double would never run those paths until a member
 * arrived and found them.
 */
lankaStorageAdapterConformance({
	vendor: "the fake, stripped to what every engine has",
	create: () => {
		const { getItem, setItem, removeItem, clear } = createLankaFakeStorageAdapter();
		return { getItem, setItem, removeItem, clear };
	},
});
