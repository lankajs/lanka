import { describe, expect, it } from "vitest";
import { createLankaAccessTracker, createLankaViewSubscription } from "lanka/extend";
import {
	createLankaVM,
	createLazyLankaVM,
	createLazySharedStoreLankaVM,
	createLazyStatelessLankaVM,
	createSharedStoreLankaVM,
	createStatelessLankaVM,
} from "lanka/viewmodel";
import {
	lankaViewBindingConformance,
	LANKA_VIEW_BINDING_SCENES,
	type ILankaConformanceState,
	type ILankaConformingBinding,
	type ILankaMountedBinding,
} from "./lankaViewBindingConformance";
import type { ILankaConformingVMFactories } from "./lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The suite, checked against bindings that are WRONG on purpose.
 *
 * A suite that passes every real binding proves only that it agrees with them.
 * What has to be proved is the other direction: that each scene REFUSES the
 * shape it was written against. Below, one broken binding per defect.
 *
 * Every one of them is a mistake a binding can actually make — a subscription
 * that outlives its reader, a tracker consulted and then ignored, a snapshot
 * read before the change rather than after. None is invented to give a scene
 * something to catch.
 *
 * ## Which fakes are ISOLATES, and why that is the interesting question
 *
 * A fake that breaks several promises at once refuses several scenes, and then
 * a scene's refusal says nothing about whether that scene asks anything the
 * others did not. So the fakes written for a single scene assert the whole
 * refusal list with `toEqual` rather than `toContain` — the assertion fails both
 * when the scene stops catching the defect AND when the fake starts breaking
 * something else, which is what keeps a new scene honest as an addition.
 *
 * `hideActions` is the worked example: it stripped the actions by enumerating
 * the object it was handed, which is the TRACKER's recording proxy, so every own
 * key was marked read before the reader read anything and the fake failed the
 * untracked-key scene too. It forwards through a Proxy now.
 *
 * `ignoreTracking`, `showStale` and `holdFirstSelection` are deliberately NOT
 * isolates: each is one defect whose consequences genuinely reach several
 * promises, and their assertions name what they catch rather than claiming a
 * single scene.
 *
 * This is why the scenes are data. A suite that existed only as `describe`/`it`
 * could not be pointed at a broken subject without nesting a runner in a runner.
 */

/** What one mounted fake component is doing while it is mounted. */
interface IFakeMount extends ILankaMountedBinding {
	/** How the reader is told to re-read. Replaced by the broken variants. */
	rerender: () => void;
}

interface IFakeBindingOptions {
	/** Forwards every notification through the selector arm, comparing nothing. */
	noSelectorEquality?: boolean;
	/** Subscribes again on every change — the identity-churn defect. */
	resubscribeEachChange?: boolean;
	/** Never releases the subscription when the component goes. */
	leakSubscription?: boolean;
	/** Re-renders for every change, tracker or no tracker. */
	ignoreTracking?: boolean;
	/** Never re-renders, whatever the tracker says. */
	renderOnce?: boolean;
	/** Reads the state from BEFORE the change — an off-by-one snapshot. */
	showStale?: boolean;
	/** Touches a member the port does not publish. */
	reachPastThePort?: boolean;
	/** Declares no server renderer, so the scene that needs one is skipped. */
	noServerRender?: boolean;
	/** Answers the first selection forever — the memo that never refreshes. */
	holdFirstSelection?: boolean;
	/**
	 * Re-reads the selection after each render and renders again when it moved.
	 *
	 * `useSyncExternalStore` performs exactly this double read, which is why a
	 * selector answering a fresh object rendered React until React stopped it. No
	 * other framework does it, so without this flag the scene that names the loop
	 * has nothing framework-free to be refused by.
	 */
	doubleReadSelection?: boolean;
	/** Hands the reader the state's data keys and drops the actions. */
	hideActions?: boolean;
	/** Keeps every mount's teardown in ONE list, so any unmount releases all. */
	shareTeardowns?: boolean;
	/** Decides with the keys read on the FIRST render, forever. */
	freezeReadSet?: boolean;
}

/**
 * A binding with no framework under it at all.
 *
 * It subscribes, tracks and re-renders exactly as a real one does, and it is
 * worth more than a test fixture: it is the port's SECOND implementation, and
 * proof that `ILankaReadableVM` can be bound without React anywhere near it.
 * `skills/structure/SKILL.md` 5d calls that the thing a shelf of one needs.
 */
/**
 * How far the resubscribing fake is allowed to go before it stops.
 *
 * That fake is broken on purpose: it opens a new subscription on every change,
 * which is the failure measured in React at 201 subscriptions for 200 renders.
 * With one subscriber per change the count DOUBLES each round — every subscriber
 * hears the change and adds another — and a ViewModel that emits more than once
 * per write turns that into an exponential nobody survives. The shared-store
 * shapes do exactly that, and the suite ran out of memory rather than reporting
 * a refusal.
 *
 * The cap changes nothing the scene asks: a binding that resubscribes is caught
 * on the FIRST change, and the scene asserts the count grew, not how far. What
 * it removes is a test double able to exhaust a machine — which is a property of
 * the double, not of anything under test.
 */
const RESUBSCRIBE_CAP = 8;

/**
 * How many times the double-reading fake will re-render before it gives up.
 *
 * Same reason as the cap above: the defect is an unbounded loop, and a double
 * that reproduced it faithfully would hang the suite rather than report a
 * refusal. The scene asserts a render BOUND, so any cap above it catches the
 * fake and no cap changes what is being asked.
 */
const DOUBLE_READ_CAP = 12;

/**
 * The state with its actions hidden — what `hideActions` hands a reader.
 *
 * A Proxy that forwards, and not a filtered copy. The object it wraps is the
 * TRACKER's recording proxy, and `Object.entries` over that reads every own key
 * through the recording trap — so a copy built that way marked the reader as
 * having read `watched` and `ignored` before it read anything, and the fake then
 * failed the untracked-key scene as well as the one it exists for. A fake that
 * breaks two promises cannot prove which of them a scene is catching.
 *
 * Forwarding keeps the recording exact: reading `watched` through this reaches
 * the tracker's trap and is recorded, and only the actions come back missing.
 */
const withoutActions = (state: ILankaConformanceState): ILankaConformanceState =>
	new Proxy(state, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver) as unknown;

			return typeof value === "function" ? undefined : value;
		},
	});

/** Whether either state disagrees with the other on any of `keys`. */
const someKeyMoved = (
	keys: ReadonlySet<string>,
	next: ILankaConformanceState,
	prev: ILankaConformanceState,
): boolean => [...keys].some((key) => !Object.is(next[key], prev[key]));

const fakeBinding = (options: IFakeBindingOptions = {}): ILankaConformingBinding => {
	/**
	 * One list of teardowns for every mount this binding makes.
	 *
	 * Only reached by `shareTeardowns`, and it lives on the BINDING rather than on
	 * a mount because that is the defect: a module-level list of unsubscribes,
	 * which works perfectly until a second component mounts and the first one
	 * leaves.
	 */
	const bindingWideStops: (() => void)[] = [];

	return {
		vendor: "Fake",

		mount: (
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			read: (state: ILankaConformanceState) => void,
		): IFakeMount => {
			let renders = 0;
			let previous: ILankaConformanceState | null = null;
			let frozenKeys: ReadonlySet<string> | null = null;
			const tracker = createLankaAccessTracker(viewModel);
			const stops: (() => void)[] = options.shareTeardowns ? bindingWideStops : [];

			if (options.reachPastThePort) {
				void (viewModel as unknown as Record<string, unknown>).getInitialState;
			}

			const rerender = () => {
				if (options.renderOnce && renders > 0) return;
				renders += 1;
				const shown = options.showStale && previous ? previous : tracker.read();
				read(options.hideActions ? withoutActions(shown) : shown);
				frozenKeys ??= new Set(tracker.trackedKeys);
			};

			const hear = (next: ILankaConformanceState, prev: ILankaConformanceState) => {
				previous = prev;
				const wakes = options.freezeReadSet
					? // The keys the reader looked at on its FIRST render, consulted for
						// ever after. A reader that starts reading a new key is then
						// deaf to it, which is the half of tracking that only shows when
						// what a component reads changes between renders.
						(frozenKeys?.size ?? 0) === 0 || someKeyMoved(frozenKeys!, next, prev)
					: options.ignoreTracking || tracker.shouldNotify(next, prev);

				if (wakes) {
					rerender();
				} else {
					tracker.reportSkipped(next, prev);
				}

				if (options.resubscribeEachChange && stops.length < RESUBSCRIBE_CAP) {
					stops.push(viewModel.subscribe(hear));
				}
			};

			rerender();
			stops.push(viewModel.subscribe(hear));

			return {
				rerender,
				renders: () => renders,
				unmount: () => {
					if (options.leakSubscription) return;
					for (const stop of stops.splice(0)) stop();
				},
				act: (change) => {
					change();
				},
			};
		},

		/**
		 * The selector arm, written the way the scenes say it must behave.
		 *
		 * A selector narrows what a reader depends on, so the reader is woken when the
		 * SELECTION moves and not when the state does. `Object.is` on the previous
		 * result is the whole of it — which is what React gets free from
		 * `useSyncExternalStore` and what the other four had to be taught.
		 *
		 * `noSelectorEquality` is the broken variant: it forwards every notification,
		 * which is what four of the five bindings did before the scenes existed.
		 */
		mountSelected: <TSelected>(
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			selector: (state: ILankaConformanceState) => TSelected,
			read: (selected: TSelected) => void,
		): IFakeMount => {
			let renders = 0;
			let last = selector(viewModel.getState());

			const rerender = (picked: TSelected) => {
				renders += 1;
				last = picked;
				read(picked);

				// The post-commit re-read. `useSyncExternalStore` takes the snapshot
				// again after committing and re-renders when it differs, which is the
				// whole of why a fresh-object selector looped in React and in nothing
				// else. Reproduced here so the scene that names the loop has a
				// framework-free binding to refuse.
				if (!options.doubleReadSelection || renders >= DOUBLE_READ_CAP) return;

				const again = selector(viewModel.getState());
				if (!Object.is(again, last)) rerender(again);
			};

			rerender(last);

			const stop = viewModel.subscribe(() => {
				/*
				 * `holdFirstSelection` answers the OPENING selection for ever.
				 *
				 * The fresh-object scene sits between two mistakes, and this is the
				 * far one: a binding that memoises a selection on something that
				 * never moves shows the first paint for the life of the component.
				 * The near one is holding it not at all, which is what made React
				 * render until it stopped itself. A scene that caught only the near
				 * one would be passed by a binding that simply never updates.
				 */
				const picked = options.holdFirstSelection ? last : selector(viewModel.getState());

				if (options.noSelectorEquality || !Object.is(picked, last)) rerender(picked);
			});

			return {
				rerender: () => rerender(selector(viewModel.getState())),
				renders: () => renders,
				unmount: () => {
					if (options.leakSubscription) return;
					stop();
				},
				act: (change) => {
					change();
				},
			};
		},

		...(options.noServerRender
			? {}
			: { renderToString: (viewModel) => JSON.stringify(viewModel.getState()) }),
	};
};

/**
 * Every scene that drives a selector answering a FRESH object.
 *
 * One over the plain factory and one per shape, because the property that makes
 * that selector survivable — `getState()` answering the same object while
 * nothing has changed — is kept a different way by each shape. Computed rather
 * than listed so a seventh shape joins the assertion by existing.
 */
const freshObjectScenes = LANKA_VIEW_BINDING_SCENES.filter((scene) =>
	scene.title.includes("FRESH object"),
).map((scene) => scene.title);

/** Which scenes refused this binding, by title. */
const scenesRefusing = async (binding: ILankaConformingBinding): Promise<string[]> => {
	const refused: string[] = [];

	for (const scene of LANKA_VIEW_BINDING_SCENES) {
		if (scene.needsServerRender === true && !binding.renderToString) continue;
		if (scene.needsSelector === true && !binding.mountSelected) continue;
		// Same skip the runner makes, and for the same reason: a scene a binding
		// cannot answer must be SKIPPED rather than counted as a refusal. Without
		// this line the fake binding — which publishes no factories, because it is
		// `createLankaAccessTracker` and nothing else — was reported as refusing
		// every declaration scene, and every test naming an exact refusal broke.
		if (scene.needsDeclare === true && !binding.declare) continue;

		try {
			await scene.run(binding);
		} catch {
			refused.push(scene.title);
		}
	}

	return refused;
};

describe("the suite itself", () => {
	it("passes a binding that keeps every promise", async () => {
		// The floor. A suite that fails a correct implementation is a suite nobody
		// can use to write the next binding.
		expect(await scenesRefusing(fakeBinding())).toEqual([]);
	});

	it("proves the port is bindable with no framework at all", async () => {
		// The fake above is not a stub: it subscribes, tracks and re-renders using
		// `createLankaAccessTracker` and nothing else. That it passes is the
		// evidence `skills/structure/SKILL.md` 5d asks of a shelf holding one
		// vendor — the port has a second implementation, and it is framework-free.
		const binding = fakeBinding();
		const scenes = LANKA_VIEW_BINDING_SCENES.length;

		expect(scenes).toBeGreaterThan(0);
		expect(await scenesRefusing(binding)).toHaveLength(0);
	});

	it("catches a subscription that outlives its reader", async () => {
		expect(await scenesRefusing(fakeBinding({ leakSubscription: true }))).toContain(
			"stops hearing anything once the component is gone",
		);
	});

	it("catches a binding that re-renders for a key nothing read", async () => {
		// The one that makes access tracking worth having. Without this scene a
		// binding could consult the tracker and then ignore it, and every screen
		// would repaint on every change while the suite stayed green.
		expect(await scenesRefusing(fakeBinding({ ignoreTracking: true }))).toContain(
			"does NOT re-render when only an untouched key changed",
		);
	});

	it("catches a binding that ignores a ViewModel turning tracking OFF", async () => {
		expect(await scenesRefusing(fakeBinding({ renderOnce: true }))).toContain(
			"re-renders for everything once the ViewModel turns tracking off",
		);
	});

	it("catches a binding that shows the value from before the change", async () => {
		expect(await scenesRefusing(fakeBinding({ showStale: true }))).toContain(
			"shows the NEW value, not a stale one",
		);
	});

	it("catches a selector arm that compares nothing", async () => {
		// The defect four of the five bindings shipped with: a ref or a signal set
		// on every notification wakes the reader whatever the selector answered, so
		// `useLankaVM(vm, selector)` meant one thing in React and another in the
		// rest. Nothing asked until this scene existed.
		await expect(scenesRefusing(fakeBinding({ noSelectorEquality: true }))).resolves.toContain(
			"a selector: does NOT re-render when its result is unchanged",
		);
	});

	it("catches a binding that subscribes again on every change", async () => {
		expect(await scenesRefusing(fakeBinding({ resubscribeEachChange: true }))).toContain(
			"subscribes at most once per mounted component",
		);
	});

	it("catches a binding that reaches past the port", async () => {
		// The scene that keeps the NEXT framework possible: a binding reading a
		// store api rather than the port works today and cannot be written twice.
		expect(await scenesRefusing(fakeBinding({ reachPastThePort: true }))).toContain(
			"reads the ViewModel through the port and nothing else",
		);
	});

	it("catches a selector arm that re-reads its snapshot and never converges", async () => {
		// The defect the scene exists for, without React. A binding that takes the
		// snapshot again after committing and re-renders when it differs never
		// agrees with a selector that builds its answer — which is how
		// `useSyncExternalStore` turned the commonest selector there is into
		// "Maximum update depth exceeded".
		// An ISOLATE: the whole refusal list, so the assertion fails if the fake
		// ever starts breaking a second promise as well.
		expect(await scenesRefusing(fakeBinding({ doubleReadSelection: true }))).toEqual(
			freshObjectScenes,
		);
	});

	it("catches a selector arm that shows its first answer for ever", async () => {
		// The far side of the fresh-object scene. A binding that holds a selection
		// too hard passes every scene about what a selector SKIPS and shows the
		// opening paint until the component is taken away.
		// NOT an isolate, and it should not be: a selection that never refreshes
		// breaks the whole selector promise rather than one clause of it. Named in
		// full so that a change to what it catches is visible here.
		expect(await scenesRefusing(fakeBinding({ holdFirstSelection: true }))).toEqual([
			"a selector: shows what it picked",
			"a selector: re-renders when its result moves",
			...freshObjectScenes,
		]);
	});

	it("catches a binding that shows the middle of a batch", async () => {
		// Several changes in one turn and the reader is shown the second of three.
		// A binding reading its snapshot when the notification arrives rather than
		// when the framework renders does exactly this, and a single change never
		// shows it: with one write, "before the change" and "one behind" are the
		// same value.
		expect(await scenesRefusing(fakeBinding({ showStale: true }))).toContain(
			"shows the LAST value when several changes land in one turn",
		);
	});

	it("catches a binding that hands back the state without its actions", async () => {
		// The shape that renders perfectly and fails at the first `onClick`. A
		// ViewModel publishes state and actions on ONE object, and a binding that
		// picked out what looked like data keeps half the promise.
		expect(await scenesRefusing(fakeBinding({ hideActions: true }))).toEqual([
			"hands the reader the ACTIONS, and calling one moves the screen",
		]);
	});

	it("catches a binding whose teardowns are shared between components", async () => {
		// One list of unsubscribes for the whole binding rather than one per
		// mounted reader. It works until a second component mounts, and then the
		// first one leaving takes the second one's subscription with it.
		expect(await scenesRefusing(fakeBinding({ shareTeardowns: true }))).toEqual([
			"keeps the surviving reader when its neighbour unmounts",
		]);
	});

	it("catches a binding that decides with the keys read on the FIRST render", async () => {
		// Half of access tracking, and the half nothing asked about: the recorded
		// set is rebuilt per state because what a component reads CHANGES — a
		// branch starts being taken, a list stops being empty. A binding holding
		// the opening set goes deaf to every key the reader took up later.
		expect(await scenesRefusing(fakeBinding({ freezeReadSet: true }))).toEqual([
			"follows the keys the reader reads NOW, not the ones it read first",
		]);
	});

	it("catches a binding that wakes on the notification rather than the comparison", async () => {
		// A key written the value it already held. Every form does this on the
		// keystroke that lands on the same character, and a binding that trusts
		// the `set` rather than the tracker repaints for all of them.
		expect(await scenesRefusing(fakeBinding({ ignoreTracking: true }))).toContain(
			"does NOT re-render when a key was written the value it already held",
		);
	});

	it("catches a binding that forwards to core and never applies its own read", async () => {
		/*
		 * The defect the six factory names exist to prevent, and the one that is
		 * invisible to every other scene.
		 *
		 * A binding publishes `createLankaVM` by handing the config straight to
		 * core and answering what core answered. The names are all there, the
		 * config is core's, the ViewModel is real, `getState` works, a screen reads
		 * it through `useLankaVM` — and the six answer something a consumer cannot
		 * call, which is the entire point of publishing them.
		 *
		 * `declare` wired to core's own six factories IS that binding, so the fake
		 * needs no invention: it is the change not made.
		 */
		const straightToCore: ILankaConformingVMFactories = {
			createLankaVM: (config) => createLankaVM(config),
			createLazyLankaVM: (config) => createLazyLankaVM(config),
			createStatelessLankaVM: (config) => createStatelessLankaVM(config),
			createLazyStatelessLankaVM: (config) => createLazyStatelessLankaVM(config),
			createSharedStoreLankaVM: (config) => createSharedStoreLankaVM(config),
			createLazySharedStoreLankaVM: (config) => createLazySharedStoreLankaVM(config),
		};

		const refused = await scenesRefusing({ ...fakeBinding(), declare: straightToCore });

		// Every one of the six, because every one of them is published and every
		// one of them must be callable. A scene list that caught only the plain
		// factory would let five of the six ship uncallable.
		expect(refused).toContain("createLankaVM answers something that is still the ViewModel");
		expect(refused).toContain(
			"createLazyLankaVM answers something that is still the ViewModel",
		);
		expect(refused).toContain(
			"createStatelessLankaVM answers something that is still the ViewModel",
		);
		expect(refused).toContain(
			"createLazyStatelessLankaVM answers something that is still the ViewModel",
		);
		expect(refused).toContain(
			"createSharedStoreLankaVM answers something that is still the ViewModel",
		);
		expect(refused).toContain(
			"createLazySharedStoreLankaVM answers something that is still the ViewModel",
		);
	});

	it("catches a binding whose LAZY factory is not lazy", async () => {
		// The likeliest way the six go wrong, and the one no type can catch: a
		// binding wires `createLazyLankaVM` to the eager factory, every screen
		// still works, and the only thing lost is the reason the lazy factory
		// exists — a ViewModel a session may never open is built at import anyway.
		const eagerlyLazy: ILankaConformingVMFactories = {
			createLankaVM: (config) => createLankaVM(config),
			createLazyLankaVM: (config) => createLankaVM(config),
			createStatelessLankaVM: (config) => createStatelessLankaVM(config),
			createLazyStatelessLankaVM: (config) => createLazyStatelessLankaVM(config),
			createSharedStoreLankaVM: (config) => createSharedStoreLankaVM(config),
			createLazySharedStoreLankaVM: (config) => createLazySharedStoreLankaVM(config),
		};

		expect(await scenesRefusing({ ...fakeBinding(), declare: eagerlyLazy })).toContain(
			"createLazyLankaVM builds nothing at the declaration, nor to answer its name",
		);
	});

	it("catches a declaration that answers a bare state instead of the ViewModel", async () => {
		// The other way they go wrong: the callable forwards the CALL and forgets
		// to forward the ViewModel, so `useTodoVM()` reads and
		// `useTodoVM.getState()` is undefined. A loader outside a component is the
		// first thing to break, and no screen notices.
		const stripped = {
			...fakeBinding(),
			declare: {
				...({
					// The config is deliberately dropped: this fake answers an object
					// that is callable-shaped and holds no ViewModel behind it.
					createLankaVM: () =>
						({ name: "ConformanceDeclaredVM" }) as unknown as ReturnType<
							ILankaConformingVMFactories["createLankaVM"]
						>,
					createLazyLankaVM: (config) => createLankaVM(config),
					createStatelessLankaVM: (config) => createStatelessLankaVM(config),
					createLazyStatelessLankaVM: (config) => createLazyStatelessLankaVM(config),
					createSharedStoreLankaVM: (config) => createSharedStoreLankaVM(config),
					createLazySharedStoreLankaVM: (config) => createLazySharedStoreLankaVM(config),
				} as ILankaConformingVMFactories),
			},
		};

		expect(await scenesRefusing(stripped)).toContain(
			"createLankaVM answers something that is still the ViewModel",
		);
	});

	it("names the scene that needs a server renderer, so it can be skipped rather than missed", () => {
		// A binding with no `renderToString` skips it. A scene quietly absent is a
		// check that cannot fail, so the runner marks it skipped by name.
		const needsServer = LANKA_VIEW_BINDING_SCENES.filter(
			(scene) => scene.needsServerRender === true,
		);

		expect(needsServer).toHaveLength(1);
		expect(needsServer[0].title).toBe("renders once on a server, and subscribes to nothing");
	});
});

/**
 * The suite RUN, against a binding with no framework under it.
 *
 * Two things at once, and the second is the point. It exercises the runner — the
 * `describe`/`it` wrapper every binding package calls — which the scene-level
 * checks above never touch. And it is the evidence
 * `skills/structure/SKILL.md` 5d asks of a shelf: the port has an implementation
 * that is not any of the five, written in plain TypeScript, and it keeps every
 * promise the five keep.
 *
 * A consumer writing a binding for a framework this repository has never heard
 * of can read `fakeBinding` above as the whole of what is required.
 */
lankaViewBindingConformance(fakeBinding());

/**
 * The same suite over a binding with no server renderer.
 *
 * The scene that needs one is SKIPPED by name rather than quietly absent, and
 * running it that way here is what proves the skip works: a scene missing from a
 * report is a check nobody can tell is not running. `@lankajs/vue`,
 * `@lankajs/svelte`, `@lankajs/solid` and `@lankajs/angular` all take this path.
 */
lankaViewBindingConformance({ ...fakeBinding({ noServerRender: true }), vendor: "Fake, no SSR" });

/**
 * The same suite over the HELPER `lanka/extend` publishes for exactly this.
 *
 * `createLankaViewSubscription` is advertised as the whole of a view binding
 * minus the framework: subscribe, ask whether the change touched anything this
 * reader read, report the skip, hand back a recording read. A third-party author
 * is told those four steps are done for them and that what remains is a render
 * trigger and a teardown.
 *
 * Nothing proved it. The fake above builds on `createLankaAccessTracker` and
 * writes the four steps out by hand, and the five shipped bindings do the same
 * because each has a selector arm the helper deliberately does not serve — so
 * the published shortcut had one caller in the repository and no claim on the
 * shelf's own bar. A promise a consumer is invited to build on, held to nothing,
 * is the first thing to rot.
 *
 * It declares no `mountSelected`, and that is the helper's documented shape
 * rather than an omission: a selector BYPASSES tracking, so a subscription that
 * took one would be two mechanisms behind one name. The selector scenes are
 * skipped by name, which is what the runner does with a scene a binding cannot
 * answer.
 */
lankaViewBindingConformance({
	vendor: "lanka/extend, createLankaViewSubscription",

	mount: (viewModel, read) => {
		let renders = 0;
		const rerender = () => {
			renders += 1;
			read(view.read());
		};
		const view = createLankaViewSubscription(viewModel, rerender);

		rerender();

		return {
			renders: () => renders,
			unmount: () => {
				view.stop();
			},
			act: (change) => {
				change();
			},
		};
	},
});
