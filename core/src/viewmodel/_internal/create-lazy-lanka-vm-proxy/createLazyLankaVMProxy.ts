import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";

/**
 * What a lazy ViewModel needs of the one behind it.
 *
 * Stated rather than cast: releasing a ViewModel means unsubscribing its
 * scenarios, so the mechanism does require this much — and every store it is
 * given has it, because `ILankaScenarioVM` is part of all three VM states.
 */
export interface ILankaReleasableStore {
	getState: () => { resetScenario: () => void };
}

/**
 * What every lazy factory is handed.
 *
 * `name` and `isAccessTracked` are here rather than read off the built
 * ViewModel because they are the two members of the port that are VALUES, and a
 * property read may not build anything — see the trap below. Both are known
 * from the config the eager factory was given, so answering them costs nothing
 * and a devtool inspecting a lazy ViewModel does not construct it.
 */
export interface ILankaLazyVMConfig<TStore> {
	/** The ViewModel's name, as the log line and the port both say it. */
	name: string;
	/** What the log calls this kind of ViewModel — `VM`, `slVM`, `ssVM`. */
	kind: string;
	/** What this ViewModel decided about access tracking. */
	isAccessTracked: boolean;
	/** Builds the real ViewModel. Called at most once until `release`. */
	create: () => TStore;
}

/** A lazily built ViewModel: everything it is, plus `dispose`. */
export type TLazyLankaVMProxy<TStore> = TStore & { dispose: () => void };

/** The one ViewModel a lazy proxy stands in front of, built at most once. */
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
	config: ILankaLazyVMConfig<TStore>,
): ILankaLazySlot<TStore> => {
	let store: TStore | null = null;
	// Where this ViewModel was DECLARED — in a scope or not — rather than where it
	// happens to be first read. See `captureScoped`.
	const buildWhereDeclared = lankaScenarioBootstrap.captureScoped();

	return {
		get: () => {
			if (!store) {
				lankaLogger.printViewModelLog(
					`LAZY: Creating ${config.kind} on first access`,
					config.name,
				);
				store = buildWhereDeclared(config.create);
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
	<TStore>(slot: ILankaLazySlot<TStore>, config: ILankaLazyVMConfig<TStore>) =>
	(_target: object, property: string | symbol): unknown => {
		if (property === "dispose") return slot.release;
		if (PROMISE_MEMBERS.has(property)) return undefined;

		// The port's two VALUE members, answered from the config without building.
		// A binding reads both before it subscribes — `useLankaVM` asks
		// `isAccessTracked` on its first render — so forwarding them as functions
		// would have made every lazy ViewModel eager the moment a screen mounted,
		// which is the whole feature.
		if (property === "name") return config.name;
		if (property === "isAccessTracked") return config.isAccessTracked;

		return (...args: unknown[]) => {
			const built = slot.get();
			const member = (built as Record<string | symbol, unknown>)[property];

			// Every remaining member of a ViewModel is a method — `getState`,
			// `subscribe`, `setState`, `getStoreState`. A value member cannot be
			// classified without building first, which is the one thing a property
			// READ may not do, so it is handed back from the call instead:
			// `lazyVM.whatever()` gives the value.
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
export const createLazyLankaVMProxy = <TStore extends ILankaReleasableStore>(
	config: ILankaLazyVMConfig<TStore>,
): TLazyLankaVMProxy<TStore> => {
	const slot = lazySlot(config);

	// An ordinary object is the target, where it used to be a function: a
	// ViewModel is read through a binding now, not called, so there is no call
	// signature left to stand in front of.
	return new Proxy(
		{},
		{ get: forwardEveryMember(slot, config) },
	) as unknown as TLazyLankaVMProxy<TStore>;
};
