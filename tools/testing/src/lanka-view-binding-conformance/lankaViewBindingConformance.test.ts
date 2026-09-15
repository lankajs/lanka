import { describe, expect, it } from "vitest";
import { createLankaAccessTracker } from "lanka/extend";
import {
	LANKA_VIEW_BINDING_SCENES,
	type ILankaConformanceState,
	type ILankaConformingBinding,
	type ILankaMountedBinding,
} from "./lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The suite, checked against bindings that are WRONG on purpose.
 *
 * A suite that passes every real binding proves only that it agrees with them.
 * What has to be proved is the other direction: that each scene REFUSES the
 * shape it was written against. Below, one broken binding per scene, each
 * breaking exactly one promise and keeping the rest.
 *
 * Every one of them is a mistake a binding can actually make — a subscription
 * that outlives its reader, a tracker consulted and then ignored, a snapshot
 * read before the change rather than after. None is invented to give a scene
 * something to catch.
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
}

/**
 * A binding with no framework under it at all.
 *
 * It subscribes, tracks and re-renders exactly as a real one does, and it is
 * worth more than a test fixture: it is the port's SECOND implementation, and
 * proof that `ILankaReadableVM` can be bound without React anywhere near it.
 * `skills/structure/SKILL.md` 5d calls that the thing a shelf of one needs.
 */
const fakeBinding = (options: IFakeBindingOptions = {}): ILankaConformingBinding => ({
	vendor: "Fake",

	mount: (
		viewModel: ILankaReadableVM<ILankaConformanceState>,
		read: (state: ILankaConformanceState) => void,
	): IFakeMount => {
		let renders = 0;
		let previous: ILankaConformanceState | null = null;
		const tracker = createLankaAccessTracker(viewModel);
		const stops: (() => void)[] = [];

		if (options.reachPastThePort) {
			void (viewModel as unknown as Record<string, unknown>).getInitialState;
		}

		const rerender = () => {
			if (options.renderOnce && renders > 0) return;
			renders += 1;
			read(options.showStale && previous ? previous : tracker.read());
		};

		const hear = (next: ILankaConformanceState, prev: ILankaConformanceState) => {
			previous = prev;
			if (options.ignoreTracking || tracker.shouldNotify(next, prev)) {
				rerender();
			} else {
				tracker.reportSkipped(next, prev);
			}

			if (options.resubscribeEachChange) stops.push(viewModel.subscribe(hear));
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

	renderToString: (viewModel) => JSON.stringify(viewModel.getState()),
});

/** Which scenes refused this binding, by title. */
const scenesRefusing = (binding: ILankaConformingBinding): string[] =>
	LANKA_VIEW_BINDING_SCENES.filter((scene) => {
		try {
			scene.run(binding);
			return false;
		} catch {
			return true;
		}
	}).map((scene) => scene.title);

describe("the suite itself", () => {
	it("passes a binding that keeps every promise", () => {
		// The floor. A suite that fails a correct implementation is a suite nobody
		// can use to write the next binding.
		expect(scenesRefusing(fakeBinding())).toEqual([]);
	});

	it("proves the port is bindable with no framework at all", () => {
		// The fake above is not a stub: it subscribes, tracks and re-renders using
		// `createLankaAccessTracker` and nothing else. That it passes is the
		// evidence `skills/structure/SKILL.md` 5d asks of a shelf holding one
		// vendor — the port has a second implementation, and it is framework-free.
		const binding = fakeBinding();
		const scenes = LANKA_VIEW_BINDING_SCENES.length;

		expect(scenes).toBeGreaterThan(0);
		expect(scenesRefusing(binding)).toHaveLength(0);
	});

	it("catches a subscription that outlives its reader", () => {
		expect(scenesRefusing(fakeBinding({ leakSubscription: true }))).toContain(
			"stops hearing anything once the component is gone",
		);
	});

	it("catches a binding that re-renders for a key nothing read", () => {
		// The one that makes access tracking worth having. Without this scene a
		// binding could consult the tracker and then ignore it, and every screen
		// would repaint on every change while the suite stayed green.
		expect(scenesRefusing(fakeBinding({ ignoreTracking: true }))).toContain(
			"does NOT re-render when only an untouched key changed",
		);
	});

	it("catches a binding that ignores a ViewModel turning tracking OFF", () => {
		expect(scenesRefusing(fakeBinding({ renderOnce: true }))).toContain(
			"re-renders for everything once the ViewModel turns tracking off",
		);
	});

	it("catches a binding that shows the value from before the change", () => {
		expect(scenesRefusing(fakeBinding({ showStale: true }))).toContain(
			"shows the NEW value, not a stale one",
		);
	});

	it("catches a binding that subscribes again on every change", () => {
		expect(scenesRefusing(fakeBinding({ resubscribeEachChange: true }))).toContain(
			"subscribes at most once per mounted component",
		);
	});

	it("catches a binding that reaches past the port", () => {
		// The scene that keeps the NEXT framework possible: a binding reading a
		// store api rather than the port works today and cannot be written twice.
		expect(scenesRefusing(fakeBinding({ reachPastThePort: true }))).toContain(
			"reads the ViewModel through the port and nothing else",
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
