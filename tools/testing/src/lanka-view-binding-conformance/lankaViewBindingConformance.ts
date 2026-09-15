import { describe, expect, it, vi } from "vitest";
import { createLankaVM, createStatelessLankaVM } from "lanka/viewmodel";
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
 * away again; what it gets back is the same eleven scenes, named the same way in
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
		{ bumpWatched: () => void; bumpIgnored: () => void }
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
	};
};

/** One scene: a title, and the check it makes against a mounted binding. */
export interface ILankaViewBindingScene {
	title: string;
	/** Needs a server renderer; skipped by a binding that declares none. */
	needsServerRender?: true;
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
			const skipped = scene.needsServerRender === true && !binding.renderToString;

			(skipped ? it.skip : it)(scene.title, async () => {
				await scene.run(binding);
			});
		}
	});
};
