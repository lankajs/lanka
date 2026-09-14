import { describe, expect, it } from "vitest";
import { createLankaAccessTracker } from "./createLankaAccessTracker";

/**
 * The recording, driven directly — no framework, no renderer, no store.
 *
 * These scenes were inside `createLankaTrackedHook` and could only be reached
 * through a React render, which meant the question "did a change touch a key
 * this reader looked at" was only ever asked in one framework's vocabulary. It
 * is the same question for every binding, so it is asked here in none of them.
 */
describe("createLankaAccessTracker", () => {
	interface IState {
		todos: string[];
		isLoading: boolean;
		error: string | null;
		[key: string]: unknown;
	}

	const stateOf = (over: Partial<IState> = {}): IState => ({
		todos: [],
		isLoading: false,
		error: null,
		...over,
	});

	const overOne = (state: IState) => createLankaAccessTracker(() => state);

	describe("what it records", () => {
		it("remembers a key read off the proxy", () => {
			const tracker = overOne(stateOf());

			void tracker.read().todos;

			expect([...tracker.trackedKeys]).toEqual(["todos"]);
		});

		it("remembers nothing until something is read", () => {
			const tracker = overOne(stateOf());

			expect([...tracker.trackedKeys]).toEqual([]);
		});

		it("remembers only what was touched, not what was there", () => {
			const tracker = overOne(stateOf());
			const state = tracker.read();

			void state.todos;
			void state.error;

			expect([...tracker.trackedKeys].sort()).toEqual(["error", "todos"]);
		});

		it("hands back the real values while recording them", () => {
			// The proxy is a recorder, not a substitute: a reader that got different
			// values from the tracked path than the plain one would be a bug nobody
			// could see until a screen showed the wrong number.
			const state = stateOf({ todos: ["a", "b"], isLoading: true });
			const tracker = overOne(state);
			const tracked = tracker.read();

			expect(tracked.todos).toBe(state.todos);
			expect(tracked.isLoading).toBe(true);
		});

		it("records a string key and ignores a symbol one", () => {
			// A symbol is not a state key any change can name: `shouldNotify`
			// compares by string, so recording one could never be consulted.
			const marker = Symbol("marker");
			const tracker = overOne(stateOf({ [marker]: 1 }));
			const tracked = tracker.read() as unknown as Record<symbol, unknown>;

			void tracked[marker];

			expect([...tracker.trackedKeys]).toEqual([]);
		});
	});

	describe("caching by the identity of the state", () => {
		it("hands back the same proxy while the state has not changed", () => {
			// Rebuilding it would start the recording over on every render, so a
			// component that read four keys would look like one that read none.
			const tracker = overOne(stateOf());

			expect(tracker.read()).toBe(tracker.read());
		});

		it("keeps the recorded keys across a second read of the same state", () => {
			const tracker = overOne(stateOf());

			void tracker.read().todos;
			tracker.read();

			expect([...tracker.trackedKeys]).toEqual(["todos"]);
		});

		it("starts a FRESH recording when the state object changes", () => {
			// The keys a reader looks at change between renders — a branch stops
			// being taken, a list empties. Keeping the old ones would re-render for a
			// key nobody reads any more, for the life of the component.
			let state = stateOf();
			const tracker = createLankaAccessTracker(() => state);

			void tracker.read().todos;
			state = stateOf({ todos: ["a"] });
			void tracker.read().isLoading;

			expect([...tracker.trackedKeys]).toEqual(["isLoading"]);
		});
	});

	describe("deciding whether a change is worth a render", () => {
		it("notifies when a key the reader READ has changed", () => {
			const tracker = overOne(stateOf());
			void tracker.read().todos;

			expect(tracker.shouldNotify(stateOf({ todos: ["a"] }), stateOf())).toBe(true);
		});

		it("stays silent when only an untouched key changed", () => {
			// The whole point of tracking: a screen reading `todos` does not repaint
			// because a spinner somewhere else turned off.
			//
			// The two states are SPREAD FROM ONE, so every key but `isLoading` keeps
			// its identity. Building them separately is what an application never
			// does — a store hands back the old value for a field it did not write —
			// and a fixture that did would make the scene below true instead.
			const before = stateOf();
			const after = { ...before, isLoading: true };
			const tracker = overOne(before);
			void tracker.read().todos;

			expect(tracker.shouldNotify(after, before)).toBe(false);
		});

		it("notifies a reader that has looked at nothing yet", () => {
			// It has not had the chance to record a key, and staying silent would
			// mean its first render never arrives.
			const tracker = overOne(stateOf());

			expect(tracker.shouldNotify(stateOf({ isLoading: true }), stateOf())).toBe(true);
		});

		it("stays silent when a tracked key was re-assigned the same value", () => {
			const same: string[] = [];
			const tracker = overOne(stateOf({ todos: same }));
			void tracker.read().todos;

			expect(tracker.shouldNotify(stateOf({ todos: same }), stateOf({ todos: same }))).toBe(
				false,
			);
		});

		it("notifies when a tracked array is a NEW array of equal contents", () => {
			// Identity, not deep equality. A gateway answering with a fresh array is
			// a change, and pretending otherwise would freeze a list that did move.
			const tracker = overOne(stateOf({ todos: ["a"] }));
			void tracker.read().todos;

			expect(tracker.shouldNotify(stateOf({ todos: ["a"] }), stateOf({ todos: ["a"] }))).toBe(
				true,
			);
		});

		it("compares with Object.is, so NaN does not look like a change", () => {
			const tracker = overOne(stateOf({ count: Number.NaN }));
			void tracker.read().count;

			expect(
				tracker.shouldNotify(
					stateOf({ count: Number.NaN }),
					stateOf({ count: Number.NaN }),
				),
			).toBe(false);
		});

		it("sees a key that appeared, and one that went away", () => {
			const tracker = overOne(stateOf());
			void tracker.read().extra;

			expect(tracker.shouldNotify(stateOf({ extra: 1 }), stateOf())).toBe(true);
			expect(tracker.shouldNotify(stateOf(), stateOf({ extra: 1 }))).toBe(true);
		});
	});

	describe("the plain read", () => {
		it("answers the state itself, never the proxy", () => {
			// A server renders once. Handing it a recorder would be work whose result
			// nothing consults.
			const state = stateOf();
			const tracker = overOne(state);

			expect(tracker.readPlain()).toBe(state);
		});

		it("records nothing", () => {
			const tracker = overOne(stateOf());

			void tracker.readPlain().todos;

			expect([...tracker.trackedKeys]).toEqual([]);
		});
	});

	describe("one tracker per reader", () => {
		it("keeps two readers of one state apart", () => {
			// Two components over one ViewModel read different keys and must
			// re-render for different changes — which is why the recording belongs
			// to the reader and not to the store.
			const before = stateOf();
			const after = { ...before, isLoading: true };
			const readsTodos = createLankaAccessTracker(() => before);
			const readsSpinner = createLankaAccessTracker(() => before);

			void readsTodos.read().todos;
			void readsSpinner.read().isLoading;

			expect(readsTodos.shouldNotify(after, before)).toBe(false);
			expect(readsSpinner.shouldNotify(after, before)).toBe(true);
		});
	});
});
