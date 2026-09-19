import { describe, expect, it, vi } from "vitest";
import {
	ALankaSharedStore,
	ALankaSharedStoreVM,
	ALankaVM,
	createLankaVM,
	createLazyLankaVM,
	createLazySharedStoreLankaVM,
	createSharedStoreLankaVM,
	ALankaStatelessVM,
	createLazyStatelessLankaVM,
	createStatelessLankaVM,
} from "lanka/viewmodel";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * What every view binding must do, asserted once for the whole shelf.
 *
 * ## Why this is not five playgrounds
 *
 * `modules/bindings/` holds one package per UI framework, and each promises the
 * same thing: a screen reads a ViewModel, re-renders for the state keys it READ
 * and for no others, and stops reading when it unmounts. The promise is
 * identical; only the mechanism differs — `useSyncExternalStore`, a
 * `shallowRef`, a signal, a Svelte subscriber.
 *
 * Written by hand five times, the five copies diverge — not on the day they are
 * written, but on the day one of them gains an assertion and the other four do
 * not. The binding that then stops keeping the promise has a green suite, which
 * is the second way a check reports success: it never asked the question.
 *
 * So the ASSERTIONS live here and the MOUNTING lives in each package. What a
 * caller supplies is its framework's way of rendering a value and taking it
 * away again; what it gets back is the same scenes, named the same way in
 * every package's output.
 *
 * ## Why the scenes may be added to and not edited
 *
 * These are the shape of `ILankaReadableVM` as a consumer meets it. If a new
 * binding cannot pass one without the wording changing, the PORT was the shape
 * of whichever framework came first — and the fix belongs in core, for
 * everybody, not in the scene. A binding may add scenes of its own beside this
 * call; React's subscription-stability measurement is one, and it has nothing
 * to compare against in a framework with no render loop.
 *
 * ## What a caller has to write
 *
 * One function. It renders a ViewModel through the binding, hands back a way to
 * read what the component currently sees, a render count, and an unmount.
 *
 * ```ts
 * describe("the React binding", () => {
 * 	lankaViewBindingConformance({
 * 		vendor: "React",
 * 		mount: (viewModel, read) => {
 * 			const seen = vi.fn();
 * 			const Screen = () => {
 * 				const state = useLankaVM(viewModel);
 * 				seen();
 * 				read(state);
 * 				return null;
 * 			};
 * 			const view = render(<Screen />);
 * 			return {
 * 				renders: () => seen.mock.calls.length,
 * 				unmount: () => { view.unmount(); },
 * 				act: (change) => { act(change); },
 * 			};
 * 		},
 * 	});
 * });
 * ```
 */

/** The state every scene below is written against. */
export interface ILankaConformanceState {
	watched: number;
	ignored: number;
	[key: string]: unknown;
}

/** What one mounted screen answers the suite. */
export interface ILankaMountedBinding {
	/** How many times the component has rendered so far. */
	renders: () => number;
	/** Takes the component away, which must release its subscription. */
	unmount: () => void;
	/**
	 * Runs a change the way this framework needs it run.
	 *
	 * React wants `act` and is done; Vue queues the render and settles on the next
	 * microtask. Either may be returned, and the suite awaits what it is given —
	 * which is why every scene is async even though most bindings need nothing of
	 * the sort.
	 *
	 * This signature was synchronous until `@lankajs/vue` was written against it,
	 * and the second binding finding it is the process working: what was React-
	 * shaped here was the ADAPTER, not the port. No scene's assertion changed.
	 */
	act: (change: () => void) => void | Promise<void>;
}

/** What a binding package hands the suite. */
export interface ILankaConformingBinding {
	/** The framework's name, for the scene titles. */
	vendor: string;
	/**
	 * Renders `viewModel` through the binding, reporting every state the
	 * component sees to `read`.
	 *
	 * `read` is what makes access tracking observable: whatever the component
	 * touches on the object it is given is what the binding recorded.
	 */
	mount: (
		viewModel: ILankaReadableVM<ILankaConformanceState>,
		read: (state: ILankaConformanceState) => void,
	) => ILankaMountedBinding;
	/**
	 * Renders `viewModel` through the binding's SELECTOR arm.
	 *
	 * Optional, and a binding without one SKIPS the selector scenes rather than
	 * passing them — a third-party binding may reasonably publish only the tracked
	 * read. All five shipped members have one, and the scenes exist because
	 * nothing else asked what a selector PROMISES: until they were written the
	 * five disagreed, and the disagreement was invisible because each package
	 * asserted its own behaviour in its own words.
	 */
	mountSelected?: <TSelected>(
		viewModel: ILankaReadableVM<ILankaConformanceState>,
		selector: (state: ILankaConformanceState) => TSelected,
		read: (selected: TSelected) => void,
	) => ILankaMountedBinding;
	/**
	 * Renders once to a string, if this framework has a server renderer.
	 *
	 * Optional, and a binding without one SKIPS scene 11 rather than passing it:
	 * a scene silently not run is the fourth way a check reports success.
	 */
	renderToString?: (
		viewModel: ILankaReadableVM<ILankaConformanceState>,
	) => string | Promise<string>;
}

interface IConformanceVM {
	viewModel: ILankaReadableVM<ILankaConformanceState>;
	bumpWatched: () => void;
	bumpIgnored: () => void;
	/**
	 * Writes `watched` the value it already holds.
	 *
	 * A ViewModel that notifies on every `set` and a tracker that compares VALUES
	 * disagree about this one, and the disagreement is invisible until a reducer
	 * writes a field back unchanged — which every form does on every keystroke
	 * that lands on the same character.
	 */
	rewriteWatched: () => void;
}

/**
 * The ViewModel every scene is driven through — built here, not by the caller.
 *
 * A binding that supplied its own could satisfy the suite with a store shaped to
 * suit it. What is under test is the binding, so the thing under it is the
 * framework's real `createLankaVM` and the same one for everybody.
 */
const conformanceVM = (tracked = true): IConformanceVM => {
	const viewModel = createLankaVM<
		ILankaConformanceState,
		{ bumpWatched: () => void; bumpIgnored: () => void; rewriteWatched: () => void }
	>({
		name: "ConformanceVM",
		enableAccessTrackingOptimization: tracked,
		states: { watched: 0, ignored: 0 },
		createActions: ({ set, get }) => ({
			bumpWatched: () => {
				set({ watched: get().watched + 1 });
			},
			bumpIgnored: () => {
				set({ ignored: get().ignored + 1 });
			},
			rewriteWatched: () => {
				set({ watched: get().watched });
			},
		}),
	});

	const state = () => viewModel.getState() as unknown as ILankaConformanceState & IConformanceVM;

	return {
		viewModel,
		bumpWatched: () => {
			state().bumpWatched();
		},
		bumpIgnored: () => {
			state().bumpIgnored();
		},
		rewriteWatched: () => {
			state().rewriteWatched();
		},
	};
};

/**
 * The same ViewModel, built every way core offers.
 *
 * Six factories and three abstractions, and an application has several of them
 * in it at once. A binding proved against ONE is a binding proved against the
 * shape whoever wrote it happened to use — and the differences are real: a lazy
 * ViewModel builds on first access, a shared-store one composes its state from
 * somebody else's slice, a class one is assembled by `build()`.
 *
 * Each of these answers the same two keys, so every scene below can be pointed
 * at any of them without a word changing.
 */
interface IConformanceActions {
	bumpWatched: () => void;
	bumpIgnored: () => void;
}

const CONFORMANCE_STATES: ILankaConformanceState = { watched: 0, ignored: 0 };

const conformanceActions = ({
	set,
	get,
}: {
	set: (patch: Partial<ILankaConformanceState>) => void;
	get: () => ILankaConformanceState;
}): IConformanceActions => ({
	bumpWatched: () => {
		set({ watched: get().watched + 1 });
	},
	bumpIgnored: () => {
		set({ ignored: get().ignored + 1 });
	},
});

/** The store a shared-store ViewModel reads, holding the same two keys. */
class ConformanceSharedStore extends ALankaSharedStore<ILankaConformanceState> {
	public constructor() {
		super(() => ({ ...CONFORMANCE_STATES }));
	}
}

/** The class style of the plain ViewModel, which `build()` assembles. */
class ConformanceClassVM extends ALankaVM<ILankaConformanceState, IConformanceActions> {
	protected readonly name = "ConformanceClassVM";

	protected override states(): ILankaConformanceState {
		return { ...CONFORMANCE_STATES };
	}

	protected createActions(): IConformanceActions {
		return conformanceActions({ set: (patch) => this.set(patch), get: () => this.get() });
	}
}

/** The class style of the shared-store ViewModel. */
class ConformanceClassSharedVM extends ALankaSharedStoreVM<
	ILankaConformanceState,
	IConformanceActions,
	ConformanceSharedStore
> {
	protected readonly name = "ConformanceClassSharedVM";

	protected createActions(): IConformanceActions {
		return conformanceActions({ set: (patch) => this.set(patch), get: () => this.get() });
	}
}

/** One way of building the conformance ViewModel, named for a scene title. */
export interface ILankaVMShape {
	name: string;
	build: () => ILankaReadableVM<ILankaConformanceState>;
}

/**
 * Every shape a stateful ViewModel comes in.
 *
 * Stateless ViewModels are NOT here and have a scene of their own: they hold no
 * state, so `watched` does not exist on one and the scenes that compare it would
 * be asking a question the shape cannot answer.
 *
 * Published, because there are callers the suite cannot serve: a binding's OWN
 * idiom — a callable ViewModel, a Pinia-shaped store, a signal per field — is not
 * what `mount` drives, so each package loops over this list in its playground to
 * hold its idiom to the same shapes. A third-party binding author has the same
 * need the day they add a spelling of their own.
 */
export const LANKA_VM_SHAPES: readonly ILankaVMShape[] = [
	{
		name: "createLankaVM",
		build: () =>
			createLankaVM<ILankaConformanceState, IConformanceActions>({
				name: "ConformanceVM",
				states: { ...CONFORMANCE_STATES },
				createActions: conformanceActions,
			}),
	},
	{
		name: "createLazyLankaVM",
		build: () =>
			createLazyLankaVM<ILankaConformanceState, IConformanceActions>({
				name: "ConformanceLazyVM",
				states: { ...CONFORMANCE_STATES },
				createActions: conformanceActions,
			}),
	},
	{
		name: "ALankaVM.build()",
		build: () => new ConformanceClassVM().build(),
	},
	{
		name: "createSharedStoreLankaVM",
		build: () =>
			createSharedStoreLankaVM<
				ILankaConformanceState,
				IConformanceActions,
				ConformanceSharedStore
			>({
				name: "ConformanceSharedVM",
				store: new ConformanceSharedStore(),
				createActions: conformanceActions,
			}),
	},
	{
		name: "createLazySharedStoreLankaVM",
		build: () =>
			createLazySharedStoreLankaVM<
				ILankaConformanceState,
				IConformanceActions,
				ConformanceSharedStore
			>({
				name: "ConformanceLazySharedVM",
				store: new ConformanceSharedStore(),
				createActions: conformanceActions,
			}),
	},
	{
		name: "ALankaSharedStoreVM.build()",
		build: () => new ConformanceClassSharedVM(new ConformanceSharedStore()).build(),
	},
];

/** What a stateless ViewModel can do, in every scene that drives one. */
export interface ILankaConformanceAnnouncer {
	announce: () => void;
	[key: string]: unknown;
}

/** The class style of the stateless ViewModel, which `build()` assembles. */
class ConformanceClassStatelessVM extends ALankaStatelessVM<ILankaConformanceAnnouncer> {
	protected readonly name = "ConformanceClassStatelessVM";

	private readonly onAnnounce: () => void;

	public constructor(onAnnounce: () => void) {
		super();
		this.onAnnounce = onAnnounce;
	}

	protected createActions(): ILankaConformanceAnnouncer {
		return { announce: () => this.onAnnounce() };
	}
}

/** One way of building a STATELESS ViewModel, named for a scene title. */
export interface ILankaStatelessVMShape {
	name: string;
	build: (onAnnounce: () => void) => ILankaReadableVM<ILankaConformanceAnnouncer>;
}

/**
 * Every shape a stateless ViewModel comes in.
 *
 * Separate from `LANKA_VM_SHAPES` because a stateless ViewModel holds nothing
 * that changes: `watched` does not exist on one, so the scenes that compare it
 * would be asking a question the shape cannot answer. What CAN be asked is the
 * property that makes it usable from a view at all — it mounts, its actions are
 * readable, and it never notifies, which is what lets one binding serve all
 * three kinds without asking which it was handed.
 */
export const LANKA_STATELESS_VM_SHAPES: readonly ILankaStatelessVMShape[] = [
	{
		name: "createStatelessLankaVM",
		build: (onAnnounce) =>
			createStatelessLankaVM<ILankaConformanceAnnouncer>({
				name: "ConformanceStatelessVM",
				createActions: () => ({ announce: onAnnounce }),
			}),
	},
	{
		name: "createLazyStatelessLankaVM",
		build: (onAnnounce) =>
			createLazyStatelessLankaVM<ILankaConformanceAnnouncer>({
				name: "ConformanceLazyStatelessVM",
				createActions: () => ({ announce: onAnnounce }),
			}),
	},
	{
		name: "ALankaStatelessVM.build()",
		build: (onAnnounce) => new ConformanceClassStatelessVM(onAnnounce).build(),
	},
];

/** One scene: a title, and the check it makes against a mounted binding. */
export interface ILankaViewBindingScene {
	title: string;
	/** Needs a server renderer; skipped by a binding that declares none. */
	needsServerRender?: true;
	/** Needs a selector arm; skipped by a binding that declares none. */
	needsSelector?: true;
	run: (binding: ILankaConformingBinding) => Promise<void>;
}

/**
 * The scenes as DATA, so the suite can be pointed at a binding that is WRONG.
 *
 * A suite written only as `describe`/`it` can be run against real bindings and
 * agrees with all of them; what has to be proved is the other direction — that
 * each scene REFUSES the shape it was written against. That needs a runner able
 * to call one scene at a time, which is what a list gives and a nest of
 * `describe` blocks does not. `lankaStorageAdapterConformance` is the precedent.
 */
export const LANKA_VIEW_BINDING_SCENES: readonly ILankaViewBindingScene[] = [
	{
		title: "shows the ViewModel's current state on the first render",
		run: async ({ mount }) => {
			const { viewModel } = conformanceVM();
			const seen: ILankaConformanceState[] = [];

			const view = mount(viewModel, (state) => seen.push({ ...state }));

			expect(seen[0]).toMatchObject({ watched: 0, ignored: 0 });
			view.unmount();
		},
	},

	{
		title: "re-renders when a key the component READ has changed",
		run: async ({ mount }) => {
			const { viewModel, bumpWatched } = conformanceVM();
			const view = mount(viewModel, (state) => {
				void state.watched;
			});
			const before = view.renders();

			await view.act(bumpWatched);

			expect(view.renders()).toBeGreaterThan(before);
			view.unmount();
		},
	},

	{
		title: "shows the NEW value, not a stale one",
		run: async ({ mount }) => {
			const { viewModel, bumpWatched } = conformanceVM();
			let latest = -1;
			const view = mount(viewModel, (state) => {
				latest = state.watched;
			});

			await view.act(bumpWatched);

			expect(latest).toBe(1);
			view.unmount();
		},
	},

	{
		title: "does NOT re-render when only an untouched key changed",
		run: async ({ mount }) => {
			// The whole of access tracking. A screen reading `watched` must not
			// repaint because a counter it never looked at moved.
			const { viewModel, bumpIgnored } = conformanceVM();
			const view = mount(viewModel, (state) => {
				void state.watched;
			});
			const before = view.renders();

			await view.act(bumpIgnored);

			expect(view.renders()).toBe(before);
			view.unmount();
		},
	},

	{
		title: "re-renders for everything once the ViewModel turns tracking off",
		run: async ({ mount }) => {
			// `enableAccessTrackingOptimization: false` is a ViewModel saying it
			// DERIVES what the screen shows. A binding that ignored it would leave a
			// frozen screen with no error anywhere.
			const { viewModel, bumpIgnored } = conformanceVM(false);
			const view = mount(viewModel, (state) => {
				void state.watched;
			});
			const before = view.renders();

			await view.act(bumpIgnored);

			expect(view.renders()).toBeGreaterThan(before);
			view.unmount();
		},
	},

	{
		title: "stops hearing anything once the component is gone",
		run: async ({ mount }) => {
			// A subscription outliving its reader is a leak AND a write into a
			// component that no longer exists.
			const { viewModel, bumpWatched } = conformanceVM();
			const view = mount(viewModel, (state) => {
				void state.watched;
			});

			view.unmount();
			const after = view.renders();
			await view.act(bumpWatched);

			expect(view.renders()).toBe(after);
		},
	},

	{
		title: "lets two components over ONE ViewModel read different keys",
		run: async ({ mount }) => {
			// Each reader's recording is its own. One repaints, the other does not.
			const { viewModel, bumpIgnored } = conformanceVM();
			const watcher = mount(viewModel, (state) => {
				void state.watched;
			});
			const ignorer = mount(viewModel, (state) => {
				void state.ignored;
			});
			const watcherBefore = watcher.renders();
			const ignorerBefore = ignorer.renders();

			await watcher.act(bumpIgnored);

			expect(watcher.renders()).toBe(watcherBefore);
			expect(ignorer.renders()).toBeGreaterThan(ignorerBefore);

			watcher.unmount();
			ignorer.unmount();
		},
	},

	{
		title: "renders a STATELESS ViewModel, and never re-renders it",
		run: async ({ mount }) => {
			// The shape with no reactive fields: its `subscribe` returns an
			// unsubscribe and never fires. One binding serves all three shapes
			// without asking which it was handed — this is that claim.
			const statelessVM = createStatelessLankaVM({
				name: "ConformanceStatelessVM",
				createActions: () => ({ doThing: () => undefined }),
			});

			const view = mount(
				statelessVM as unknown as ILankaReadableVM<ILankaConformanceState>,
				(state) => {
					void state.watched;
				},
			);

			expect(view.renders()).toBeGreaterThan(0);
			const before = view.renders();
			await view.act(() => undefined);
			expect(view.renders()).toBe(before);

			view.unmount();
		},
	},

	{
		title: "reads the ViewModel through the port and nothing else",
		run: async ({ mount }) => {
			// A binding may call `getState`, `subscribe` and read the two value
			// members. Reaching for anything else — a store api, a zustand
			// internal — is what makes the next framework's binding impossible.
			const { viewModel } = conformanceVM();
			const port = new Set(["name", "getState", "subscribe", "isAccessTracked"]);
			const touched = new Set<string>();

			const watched = new Proxy(viewModel, {
				get(target, property, receiver) {
					if (typeof property === "string") touched.add(property);
					return Reflect.get(target, property, receiver) as unknown;
				},
			});

			const view = mount(watched, (state) => {
				void state.watched;
			});
			view.unmount();

			expect([...touched].filter((name) => !port.has(name))).toEqual([]);
		},
	},

	{
		title: "subscribes at most once per mounted component",
		run: async ({ mount }) => {
			// The defect: keying the subscription on a value that is new every
			// render tears it down and rebuilds it each time — measured once at 201
			// subscriptions for 200 renders.
			const { viewModel, bumpWatched } = conformanceVM();
			const subscribe = vi.spyOn(viewModel, "subscribe");

			const view = mount(viewModel, (state) => {
				void state.watched;
			});
			await view.act(bumpWatched);
			await view.act(bumpWatched);

			expect(subscribe.mock.calls.length).toBeLessThanOrEqual(1);
			view.unmount();
			subscribe.mockRestore();
		},
	},

	{
		title: "renders once on a server, and subscribes to nothing",
		needsServerRender: true,
		run: async ({ renderToString }) => {
			// A server renders once and throws the tree away. A subscription there is
			// a listener nobody will ever remove.
			const { viewModel } = conformanceVM();
			const subscribe = vi.spyOn(viewModel, "subscribe");

			const html = await renderToString!(viewModel);

			expect(html).toBeTypeOf("string");
			expect(subscribe).not.toHaveBeenCalled();
			subscribe.mockRestore();
		},
	},
	/*
	 * The SELECTOR arm, which is the second thing every member publishes.
	 *
	 * Nothing asked what a selector PROMISES until these existed, and the five
	 * disagreed — invisibly, because each package asserted its own behaviour in
	 * its own words.
	 */
	{
		title: "a selector: shows what it picked",
		needsSelector: true,
		run: async ({ mountSelected }) => {
			const { viewModel, bumpWatched } = conformanceVM();
			const seen: number[] = [];

			const view = mountSelected!(
				viewModel,
				(state) => state.watched,
				(picked) => seen.push(picked),
			);
			await view.act(bumpWatched);

			expect(seen.at(-1)).toBe(1);
			view.unmount();
		},
	},

	{
		title: "a selector: does NOT re-render when its result is unchanged",
		needsSelector: true,
		run: async ({ mountSelected }) => {
			/*
			 * What a selector IS, and the scene the shelf did not have.
			 *
			 * A selector narrows what a reader depends on, so a change that leaves
			 * the selection alone must leave the reader alone. React got this free
			 * from `useSyncExternalStore`, which bails on an `Object.is`-equal
			 * snapshot; the four bindings built on a ref or a signal forced the
			 * update and re-rendered for every notification — so the same call
			 * meant two different things depending on which package answered it.
			 */
			const { viewModel, bumpIgnored } = conformanceVM();
			const view = mountSelected!(
				viewModel,
				(state) => state.watched,
				() => undefined,
			);
			const before = view.renders();

			await view.act(bumpIgnored);

			expect(view.renders()).toBe(before);
			view.unmount();
		},
	},

	{
		title: "a selector: re-renders when its result moves",
		needsSelector: true,
		run: async ({ mountSelected }) => {
			const { viewModel, bumpWatched } = conformanceVM();
			const view = mountSelected!(
				viewModel,
				(state) => state.watched,
				() => undefined,
			);
			const before = view.renders();

			await view.act(bumpWatched);

			expect(view.renders()).toBeGreaterThan(before);
			view.unmount();
		},
	},

	{
		title: "a selector: releases its subscription on unmount",
		needsSelector: true,
		run: async ({ mountSelected }) => {
			const { viewModel, bumpWatched } = conformanceVM();
			const seen: number[] = [];
			const view = mountSelected!(
				viewModel,
				(state) => state.watched,
				(picked) => seen.push(picked),
			);

			view.unmount();
			await Promise.resolve(bumpWatched());

			// The selector arm is a second subscription path, and a binding that
			// released only the tracked one would leak exactly half the time.
			expect(seen.at(-1)).toBe(0);
		},
	},

	{
		title: "a selector: survives one that answers a FRESH object every call",
		needsSelector: true,
		run: async ({ mountSelected }) => {
			/*
			 * The commonest selector there is, and the one nothing asked about.
			 *
			 * `(state) => ({ a: state.a })` and `(state) => rows.filter(…)` build a
			 * new object on every call, so no equality by identity can ever hold.
			 * Four bindings compare the selection to the last one and simply wake
			 * every time, which is correct if wasteful. React's
			 * `useSyncExternalStore` re-reads the snapshot after committing and
			 * re-renders when it differs — so a selection that is never identical
			 * rendered forever, and the binding threw "Maximum update depth
			 * exceeded" on the shape a consumer reaches for first.
			 *
			 * What the scene pins is the promise, not the mechanism: the reader is
			 * shown what the selector picked, and the render loop terminates.
			 */
			const { viewModel, bumpWatched } = conformanceVM();
			const seen: { watched: number }[] = [];

			const view = mountSelected!(
				viewModel,
				(state) => ({ watched: state.watched }),
				(picked) => seen.push(picked),
			);
			await view.act(bumpWatched);

			expect(seen.at(-1)).toEqual({ watched: 1 });

			/*
			 * And the loop TERMINATED, which is the half a value assertion cannot
			 * reach. A binding that re-reads its snapshot after committing and
			 * re-renders when it differs shows the right value every time and never
			 * stops; the bound is what says so. One mount and one change is two
			 * renders in every member of the shelf, so the room here is generous and
			 * still nowhere near a binding that does not converge.
			 */
			expect(view.renders()).toBeLessThan(6);
			view.unmount();
		},
	},

	{
		title: "shows the LAST value when several changes land in one turn",
		run: async ({ mount }) => {
			// A binding that reads its snapshot when the FIRST notification arrives
			// rather than when the framework renders shows the middle of a batch.
			// One character typed into a controlled input is three writes in some
			// reducers, and the screen then trails the state by two.
			const { viewModel, bumpWatched } = conformanceVM();
			let latest = -1;

			const view = mount(viewModel, (state) => {
				latest = state.watched;
			});

			await view.act(() => {
				bumpWatched();
				bumpWatched();
				bumpWatched();
			});

			expect(latest).toBe(3);
			expect(viewModel.getState().watched).toBe(3);
			view.unmount();
		},
	},

	{
		title: "hands the reader the ACTIONS, and calling one moves the screen",
		run: async ({ mount }) => {
			/*
			 * The whole loop a consumer writes, in one scene: read a field, call the
			 * action sitting beside it, see the field move.
			 *
			 * A ViewModel publishes its state and its actions on ONE object, and a
			 * binding that hands back only the state keys — a `for` over what looked
			 * like data, a pick of the non-function members — compiles, renders and
			 * fails at the first `onClick`.
			 */
			const { viewModel } = conformanceVM();
			let latest: ILankaConformanceState | null = null;

			const view = mount(viewModel, (state) => {
				void state.watched;
				latest = state;
			});

			const actions = latest as unknown as { bumpWatched?: () => void } | null;
			expect(typeof actions?.bumpWatched).toBe("function");

			await view.act(() => {
				actions!.bumpWatched!();
			});

			expect((latest as unknown as ILankaConformanceState).watched).toBe(1);
			view.unmount();
		},
	},

	{
		title: "keeps the surviving reader when its neighbour unmounts",
		run: async ({ mount }) => {
			// The defect the testing canon names: a subscriber removed mid-list
			// silences the next one, because the dispatch is walking the very array
			// the removal spliced. It needs TWO readers and one of them leaving to
			// show at all, and every scene above mounts one or never unmounts.
			const { viewModel, bumpWatched } = conformanceVM();
			const leaving = mount(viewModel, (state) => {
				void state.watched;
			});
			const staying = mount(viewModel, (state) => {
				void state.watched;
			});

			leaving.unmount();
			const before = staying.renders();
			await staying.act(bumpWatched);

			expect(staying.renders()).toBeGreaterThan(before);
			staying.unmount();
		},
	},

	{
		title: "does NOT re-render when a key was written the value it already held",
		run: async ({ mount }) => {
			// A reducer writing a field back unchanged is what every form does on the
			// keystroke that lands on the same character. Tracking compares VALUES,
			// so the notification must die here — and a binding that wakes on the
			// notification rather than on the comparison repaints on every keypress.
			const { viewModel, rewriteWatched } = conformanceVM();
			const view = mount(viewModel, (state) => {
				void state.watched;
			});
			const before = view.renders();

			await view.act(rewriteWatched);

			expect(view.renders()).toBe(before);
			view.unmount();
		},
	},

	{
		title: "follows the keys the reader reads NOW, not the ones it read first",
		run: async ({ mount }) => {
			/*
			 * The recorded set is rebuilt per state, so a reader that starts reading
			 * a new key is woken for it from then on — and one that STOPS reading a
			 * key is not woken for that key any more.
			 *
			 * Both halves are asserted, because a binding that cached the proxy
			 * across changes passes the first and fails the second, and a binding
			 * that rebuilt the tracker per notification passes the second and loses
			 * every recording made during the render.
			 */
			const { viewModel, bumpWatched, bumpIgnored } = conformanceVM();
			let alsoReadsIgnored = false;

			const view = mount(viewModel, (state) => {
				void state.watched;
				if (alsoReadsIgnored) void state.ignored;
			});

			// Not yet read: a change to it must not wake anybody.
			const beforeBlind = view.renders();
			await view.act(bumpIgnored);
			expect(view.renders()).toBe(beforeBlind);

			// Start reading it, on a render caused by the key that IS read.
			alsoReadsIgnored = true;
			await view.act(bumpWatched);

			const beforeSeeing = view.renders();
			await view.act(bumpIgnored);

			expect(view.renders()).toBeGreaterThan(beforeSeeing);
			view.unmount();
		},
	},

	/*
	 * One scene per SHAPE, and they are the last of the list on purpose.
	 *
	 * Everything above proves what a binding does; these prove it does it to every
	 * ViewModel an application actually holds. Core publishes six factories and
	 * three abstractions, and a binding written against the plain factory has been
	 * proved against the shape its author happened to reach for.
	 */
	...LANKA_VM_SHAPES.map((shape): ILankaViewBindingScene => ({
		title: `reads a ViewModel built with ${shape.name}`,
		run: async ({ mount }) => {
			const viewModel = shape.build();
			const seen: ILankaConformanceState[] = [];
			const view = mount(viewModel, (state) => {
				void state.watched;
				seen.push({ ...state });
			});
			const before = view.renders();

			await view.act(() => {
				(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();
			});

			expect(seen[0]).toMatchObject({ watched: 0 });
			expect(view.renders()).toBeGreaterThan(before);
			expect(viewModel.getState().watched).toBe(1);
			view.unmount();
		},
	})),

	/*
	 * The fresh-object selector, over every shape as well.
	 *
	 * The scene above drives `createLankaVM`, and what makes it survivable is that
	 * `getState()` answers the SAME object while nothing has changed — a binding
	 * that holds a selection against the state it came from depends on exactly
	 * that. Each shape keeps the property a different way: the plain factory gets
	 * it from the store, a shared-store ViewModel composes its state and memoises
	 * the composition by hand, a lazy one answers through a proxy that builds on
	 * first access. Three implementations of one guarantee, and only the first was
	 * being asked.
	 */
	...LANKA_VM_SHAPES.map((shape): ILankaViewBindingScene => ({
		title: `a selector answering a FRESH object over ${shape.name}`,
		needsSelector: true,
		run: async ({ mountSelected }) => {
			const viewModel = shape.build();
			const seen: { watched: number }[] = [];

			const view = mountSelected!(
				viewModel,
				(state) => ({ watched: state.watched }),
				(picked) => seen.push(picked),
			);
			await view.act(() => {
				(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();
			});

			expect(seen.at(-1)).toEqual({ watched: 1 });
			expect(view.renders()).toBeLessThan(6);
			view.unmount();
		},
	})),

	/*
	 * And one per STATELESS shape, which cannot answer the comparisons above.
	 *
	 * A stateless ViewModel holds nothing that changes, so `watched` does not
	 * exist on one. What is asked instead is the property that makes it usable
	 * from a view at all — it mounts, its actions are readable, and it never
	 * notifies. The cast is that difference stated out loud: the adapter is typed
	 * for the state every other scene compares, and this shape has none.
	 */
	...LANKA_STATELESS_VM_SHAPES.map((shape): ILankaViewBindingScene => ({
		title: `reads a ViewModel built with ${shape.name}`,
		run: async ({ mount }) => {
			let called = 0;
			const viewModel = shape.build(() => {
				called += 1;
			});
			const seen: unknown[] = [];

			const view = mount(
				viewModel as unknown as ILankaReadableVM<ILankaConformanceState>,
				(state) => seen.push(state),
			);
			const before = view.renders();

			viewModel.getState().announce();

			expect(called).toBe(1);
			expect(seen).toHaveLength(1);
			expect(view.renders()).toBe(before);
			view.unmount();
		},
	})),
];

/**
 * Runs every scene against one binding.
 *
 * A binding with no server renderer SKIPS the scene that needs one rather than
 * passing it: a scene quietly not run is a check that cannot fail.
 */
export const lankaViewBindingConformance = (binding: ILankaConformingBinding): void => {
	describe(`${binding.vendor}: what a binding promises`, () => {
		for (const scene of LANKA_VIEW_BINDING_SCENES) {
			const skipped =
				(scene.needsServerRender === true && !binding.renderToString) ||
				(scene.needsSelector === true && !binding.mountSelected);

			(skipped ? it.skip : it)(scene.title, async () => {
				await scene.run(binding);
			});
		}
	});
};
