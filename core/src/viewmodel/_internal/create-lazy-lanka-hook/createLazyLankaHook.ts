import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";

/**
 * What a lazy hook needs of the store behind it.
 *
 * Stated rather than cast: releasing a ViewModel means unsubscribing its
 * scenarios, so the mechanism does require this much — and every store it is
 * given has it, because `ILankaScenarioVM` is part of all three VM states.
 */
export interface ILankaReleasableStore {
	getState: () => { resetScenario: () => void };
}

/** What every lazy factory is handed: a name for the log, and how to build. */
export interface ILankaLazyHookConfig<TStore> {
	/** The ViewModel's name, as the log line says it. */
	name: string;
	/** What the log calls this kind of ViewModel — `VM`, `slVM`, `ssVM`. */
	kind: string;
	/** Builds the real store. Called at most once until `release`. */
	create: () => TStore;
}

/** A lazily built store: everything the store is, plus `dispose`. */
export type TLazyLankaHook<TStore> = TStore & { dispose: () => void };

/** The one store a lazy hook stands in front of, built at most once. */
interface ILankaLazySlot<TStore> {
	get: () => TStore;
	release: () => void;
}

/**
 * Build once, release on demand: the state a lazy hook is made of.
 *
 * Separate from the forwarding below because they answer different questions —
 * WHEN the store exists, and WHERE a call goes. Read together they were one
 * function of fifty lines, which the composition canon calls what it is.
 */
const lazySlot = <TStore extends ILankaReleasableStore>(
	config: ILankaLazyHookConfig<TStore>,
): ILankaLazySlot<TStore> => {
	let store: TStore | null = null;

	return {
		get: () => {
			if (!store) {
				lankaLogger.printViewModelLog(
					`LAZY: Creating ${config.kind} on first access`,
					config.name,
				);
				store = config.create();
			}
			return store;
		},

		/**
		 * Releases the store. The next access builds a new one.
		 *
		 * Scenario subscriptions go first, through `resetScenario` — the same path
		 * the between-tests reset uses. Dropping the reference without
		 * unsubscribing would leave the bus holding handlers that write into a
		 * discarded store.
		 *
		 * On a slot that never built, this does NOTHING: building a store in order
		 * to destroy it is work with no result, and it would resurrect a ViewModel
		 * a closed screen had just released.
		 */
		release: () => {
			if (!store) return;
			store.getState().resetScenario();
			store = null;
		},
	};
};

/**
 * How a member reaches the store: through a wrapper, always.
 *
 * The trap returns a FUNCTION for every member rather than the member itself, so
 * reading `useVM.setState` builds nothing and calling it builds the store. A trap
 * that resolved eagerly would end laziness the moment a devtool, a spread or a
 * debugger looked at the object — which is most of the ways an object is looked
 * at.
 *
 * `dispose` is the exception in both directions: it is not the store's, and it
 * must not build one.
 *
 * ## The thenable trap
 *
 * `then` is answered with `undefined`, never with a wrapper, and that line is
 * load-bearing. `await` and `Promise.resolve` decide whether a value is a
 * promise by READING `.then` and checking it is callable: a trap that returns a
 * function for every name says yes to that question for an object that is not a
 * promise. The runtime then calls it as `then(resolve, reject)`, the wrapper
 * forwards to a store member that does not exist, gets `undefined`, and neither
 * callback is ever invoked — so the `await` hangs FOREVER, with no error and no
 * stack.
 *
 * That makes `await someLazyVM` and every `async` function that RETURNS one a
 * silent deadlock, which is a shape a test harness reaches for constantly:
 * `const vm = await load()` resolves a promise with the proxy, and resolution
 * adopts a thenable. It cost an afternoon in a consumer's suite, where nineteen
 * tests timed out at 30s each and named their own first line.
 *
 * `catch` and `finally` are excluded with it. They are not part of the
 * thenable check, but an object answering `then` alone while a caller treats it
 * as a promise is the more confusing half of the same mistake — and no zustand
 * store has a member by either name.
 */
const PROMISE_MEMBERS: ReadonlySet<string | symbol> = new Set(["then", "catch", "finally"]);

const forwardEveryMember =
	<TStore>(slot: ILankaLazySlot<TStore>) =>
	(_target: object, property: string | symbol): unknown => {
		if (property === "dispose") return slot.release;
		if (PROMISE_MEMBERS.has(property)) return undefined;

		return (...args: unknown[]) => {
			const built = slot.get();
			const member = (built as Record<string | symbol, unknown>)[property];

			// Every member of a zustand store is a method, and so is every one a
			// ViewModel adds — `getStoreState` included. A value member cannot be
			// classified without building the store first, which is the one thing a
			// property READ may not do, so it is handed back from the call instead:
			// `useVM.whatever()` gives the value.
			return typeof member === "function"
				? (member as (...rest: unknown[]) => unknown).apply(built, args)
				: member;
		};
	};

/**
 * The lazy half of every ViewModel factory, written once.
 *
 * Three factories used to carry this mechanism: build on first access, keep the
 * store, hand every member through, release on `dispose`. They differed in the
 * one line that builds — and, as it turned out, in which members they had
 * remembered to hand through.
 *
 * ## Why a Proxy rather than a list of members
 *
 * The three copies attached members BY HAND, and the three lists differed:
 * `getState` + `getInitialState` + `setState` + `subscribe` for the plain one,
 * `getState` alone for the stateless, `getState` + `getStoreState` for the
 * shared-store. Each list matched its own type, so nothing was broken — but the
 * plain one MIRRORS a zustand store, and a mirror is a promise to keep in step
 * with something somebody else releases. The day zustand adds a member, three
 * files have to hear about it.
 *
 * A Proxy cannot be incomplete. What the built store has, the lazy hook has, and
 * the type each factory declares is what narrows it back down to that variant's
 * contract — a lazy variant promises exactly what its eager twin promises, plus
 * `dispose`.
 */
export const createLazyLankaHook = <TStore extends ILankaReleasableStore>(
	config: ILankaLazyHookConfig<TStore>,
): TLazyLankaHook<TStore> => {
	const slot = lazySlot(config);

	// The hook itself: a function, so `useVM()` and `useVM(selector)` work before
	// anything is built.
	const hook = (selector?: (state: unknown) => unknown): unknown => {
		const built = slot.get() as unknown as (chosen?: unknown) => unknown;
		return selector ? built(selector) : built();
	};

	return new Proxy(hook, { get: forwardEveryMember(slot) }) as unknown as TLazyLankaHook<TStore>;
};
