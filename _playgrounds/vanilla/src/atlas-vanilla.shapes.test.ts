import { readFileSync } from "node:fs";
import {
	ALankaSharedStore,
	ALankaSharedStoreVM,
	ALankaStatelessVM,
	ALankaVM,
	createLankaSharedStore,
	createLankaVM,
	createLazyLankaVM,
	createLazySharedStoreLankaVM,
	createLazyStatelessLankaVM,
	createSharedStoreLankaVM,
	createStatelessLankaVM,
} from "lanka/viewmodel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindAtlasVM } from "./Core/Render/bindAtlasVM";
import { renderAtlasList } from "./Core/Render/renderAtlasList";

/**
 * Every shape of ViewModel, read with no framework at all.
 *
 * The five bindings are held to all nine shapes by the conformance suite. This
 * asks the same question with nothing on the other side: a ViewModel read by
 * three lines of DOM code, which is the sentence the whole port exists to make
 * true. If a shape only worked through a binding, the binding would be carrying
 * it — and nothing in a binding's own suite could tell.
 *
 * The three lines are `bindAtlasVM`: paint once, then paint on every change.
 */
interface IWatchedState {
	watched: number;
	ignored: number;
}

interface IWatchedActions {
	bump: () => void;
	bumpIgnored: () => void;
}

const STATES: IWatchedState = { watched: 0, ignored: 0 };

const actionsOver = (
	set: (patch: Partial<IWatchedState>) => void,
	get: () => IWatchedState,
): IWatchedActions => ({
	bump: () => set({ watched: get().watched + 1 }),
	bumpIgnored: () => set({ ignored: get().ignored + 1 }),
});

class VanillaSharedStore extends ALankaSharedStore<IWatchedState> {
	public constructor() {
		super(() => ({ ...STATES }));
	}
}

class VanillaClassVM extends ALankaVM<IWatchedState, IWatchedActions> {
	protected readonly name = "VanillaClassVM";

	protected override states(): IWatchedState {
		return { ...STATES };
	}

	protected createActions(): IWatchedActions {
		return actionsOver(
			(patch) => this.set(patch),
			() => this.get(),
		);
	}
}

class VanillaClassSharedVM extends ALankaSharedStoreVM<
	IWatchedState,
	IWatchedActions,
	VanillaSharedStore
> {
	protected readonly name = "VanillaClassSharedVM";

	protected createActions(): IWatchedActions {
		return actionsOver(
			(patch) => this.set(patch),
			() => this.get(),
		);
	}
}

/** Every STATEFUL shape, named so a failure says which one. */
const STATEFUL = [
	{
		name: "the plain factory",
		build: () =>
			createLankaVM<IWatchedState, IWatchedActions>({
				name: "VanillaVM",
				states: { ...STATES },
				createActions: ({ set, get }) => actionsOver(set, get),
			}),
	},
	{
		name: "the LAZY factory",
		build: () =>
			createLazyLankaVM<IWatchedState, IWatchedActions>({
				name: "VanillaLazyVM",
				states: { ...STATES },
				createActions: ({ set, get }) => actionsOver(set, get),
			}),
	},
	{ name: "the class style", build: () => new VanillaClassVM().build() },
	{
		name: "the SHARED-STORE factory",
		build: () =>
			createSharedStoreLankaVM<IWatchedState, IWatchedActions, VanillaSharedStore>({
				name: "VanillaSharedVM",
				store: new VanillaSharedStore(),
				createActions: ({ set, get }) => actionsOver(set, get),
			}),
	},
	{
		name: "the LAZY shared-store factory",
		build: () =>
			createLazySharedStoreLankaVM<IWatchedState, IWatchedActions, VanillaSharedStore>({
				name: "VanillaLazySharedVM",
				store: new VanillaSharedStore(),
				createActions: ({ set, get }) => actionsOver(set, get),
			}),
	},
	{
		name: "the shared-store class style",
		build: () => new VanillaClassSharedVM(new VanillaSharedStore()).build(),
	},
] as const;

/** Every STATELESS shape, which holds nothing that changes. */
const STATELESS = [
	{
		name: "the stateless factory",
		build: (onAnnounce: () => void) =>
			createStatelessLankaVM<{ announce: () => void }>({
				name: "VanillaStatelessVM",
				createActions: () => ({ announce: onAnnounce }),
			}),
	},
	{
		name: "the LAZY stateless factory",
		build: (onAnnounce: () => void) =>
			createLazyStatelessLankaVM<{ announce: () => void }>({
				name: "VanillaLazyStatelessVM",
				createActions: () => ({ announce: onAnnounce }),
			}),
	},
	{
		name: "the stateless class style",
		build: (onAnnounce: () => void) => {
			class VanillaClassStatelessVM extends ALankaStatelessVM<{ announce: () => void }> {
				protected readonly name = "VanillaClassStatelessVM";

				protected createActions(): { announce: () => void } {
					return { announce: onAnnounce };
				}
			}

			return new VanillaClassStatelessVM().build();
		},
	},
] as const;

let root: HTMLElement;

beforeEach(() => {
	root = document.createElement("main");
	document.body.append(root);
});

afterEach(() => {
	root.remove();
	vi.restoreAllMocks();
});

describe("painting every STATEFUL shape with three lines of DOM", () => {
	for (const shape of STATEFUL) {
		it(`paints and repaints over ${shape.name}`, () => {
			const viewModel = shape.build();
			const painted: number[] = [];

			const stop = bindAtlasVM(viewModel, (state) => painted.push(state.watched));
			viewModel.getState().bump();

			// One paint before anything changed, one after — which is the whole of
			// what a binding does, with no binding present.
			expect(painted).toEqual([0, 1]);
			stop();
		});
	}

	for (const shape of STATEFUL) {
		it(`stops painting over ${shape.name} once released`, () => {
			const viewModel = shape.build();
			const painted: number[] = [];
			const stop = bindAtlasVM(viewModel, (state) => painted.push(state.watched));

			stop();
			viewModel.getState().bump();

			expect(painted).toEqual([0]);
			expect(viewModel.getState().watched).toBe(1);
		});
	}
});

describe("reading every STATELESS shape with no framework", () => {
	for (const shape of STATELESS) {
		it(`calls an action on ${shape.name} and is never woken`, () => {
			let called = 0;
			const viewModel = shape.build(() => {
				called += 1;
			});
			const painted: unknown[] = [];
			const stop = bindAtlasVM(viewModel, (state) => painted.push(state));

			viewModel.getState().announce();

			// A stateless ViewModel holds nothing that changes, so `subscribe` hands
			// back an unsubscribe and calls nobody. One paint, ever.
			expect(called).toBe(1);
			expect(painted).toHaveLength(1);
			stop();
		});
	}
});

describe("two readers of one ViewModel, with nothing between them", () => {
	it("gives each its own recording", () => {
		// The property every binding inherits and none of them implements: the
		// recording belongs to whoever did the reading. Here the readers are two
		// closures.
		const viewModel = createLankaVM<IWatchedState, IWatchedActions>({
			name: "TwoReadersVM",
			states: { ...STATES },
			createActions: ({ set, get }) => actionsOver(set, get),
		});
		const watching: number[] = [];
		const ignoring: number[] = [];

		const stopWatching = bindAtlasVM(viewModel, (state) => watching.push(state.watched));
		const stopIgnoring = bindAtlasVM(viewModel, (state) => ignoring.push(state.ignored));
		viewModel.getState().bump();

		expect(watching).toEqual([0, 1]);
		expect(ignoring).toEqual([0, 0]);
		stopWatching();
		stopIgnoring();
	});

	it("keeps one shared store behind two ViewModels", () => {
		// Two ViewModels over one store is the shape a feature split across screens
		// takes, and it works here with no renderer to coordinate them.
		const store = createLankaSharedStore<IWatchedState>(() => ({ ...STATES }));
		const first = createSharedStoreLankaVM<
			IWatchedState,
			IWatchedActions,
			ALankaSharedStore<IWatchedState>
		>({
			name: "FirstSharedVM",
			store,
			createActions: ({ set, get }) => actionsOver(set, get),
		});
		const second = createSharedStoreLankaVM<
			IWatchedState,
			IWatchedActions,
			ALankaSharedStore<IWatchedState>
		>({
			name: "SecondSharedVM",
			store,
			createActions: ({ set, get }) => actionsOver(set, get),
		});
		const seen: number[] = [];
		const stop = bindAtlasVM(second, (state) => seen.push(state.watched));

		first.getState().bump();

		expect(seen.at(-1)).toBe(1);
		expect(second.getStoreState().watched).toBe(1);
		stop();
	});
});

describe("the DOM half, driven directly", () => {
	it("paints a list from any shape's state", () => {
		const viewModel = new VanillaClassVM().build();
		const list = document.createElement("ul");
		root.append(list);

		const stop = bindAtlasVM(viewModel, (state) =>
			renderAtlasList(list, [state.watched, state.ignored], (value) => String(value)),
		);
		viewModel.getState().bump();

		expect([...list.children].map((item) => item.textContent)).toEqual(["1", "0"]);
		stop();
	});

	it("still needs no UI framework to do it", () => {
		// The scene beside this one asserts the package installs none. This asserts
		// the SHAPES file — the one that reaches for every factory core has — added
		// no import of one either.
		const source = readFileSync("src/atlas-vanilla.shapes.test.ts", "utf8");

		expect(source).not.toMatch(/from "(react|vue|svelte|solid-js|@angular)/);
	});
});
