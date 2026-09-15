import { describe, expect, it, vi } from "vitest";
import { createLankaViewSubscription } from "./createLankaViewSubscription";
import { createLankaVM } from "../create-lanka-vm/createLankaVM";
import { createStatelessLankaVM } from "../create-stateless-lanka-vm/createStatelessLankaVM";

/**
 * The four steps every binding takes, driven with no framework at all.
 *
 * Five packages wrote these out by hand and a sixth — somebody's, for a
 * framework this repository has never heard of — would have written them a sixth
 * time. What is asserted here is the decision each of those copies was making:
 * when a reader is woken, when it is deliberately not, and that the read is live
 * rather than a snapshot.
 */
interface IWatchedState {
	watched: number;
	ignored: number;
	[key: string]: unknown;
}

interface IWatchedActions {
	bumpWatched: () => void;
	bumpIgnored: () => void;
}

const build = () =>
	createLankaVM<IWatchedState, IWatchedActions>({
		name: "SubscriptionSpecVM",
		states: { watched: 0, ignored: 0 },
		createActions: ({ set, get }) => ({
			bumpWatched: () => set({ watched: get().watched + 1 }),
			bumpIgnored: () => set({ ignored: get().ignored + 1 }),
		}),
	});

describe("waking the reader", () => {
	it("calls onChange when a key the reader READ has moved", () => {
		const viewModel = build();
		const onChange = vi.fn();
		const view = createLankaViewSubscription(viewModel, onChange);
		void view.read().watched;

		viewModel.getState().bumpWatched();

		expect(onChange).toHaveBeenCalledTimes(1);
		view.stop();
	});

	it("does NOT call onChange for a key nothing read", () => {
		// The whole of access tracking in one assertion, and the reason a binding
		// may not simply forward every notification.
		const viewModel = build();
		const onChange = vi.fn();
		const view = createLankaViewSubscription(viewModel, onChange);
		void view.read().watched;

		viewModel.getState().bumpIgnored();

		expect(onChange).not.toHaveBeenCalled();
		view.stop();
	});

	it("calls onChange for everything when the reader has read nothing yet", () => {
		// A reader that has not had the chance to record a key must not be left
		// out: its FIRST update is the one that would never arrive.
		const viewModel = build();
		const onChange = vi.fn();
		const view = createLankaViewSubscription(viewModel, onChange);

		viewModel.getState().bumpIgnored();

		expect(onChange).toHaveBeenCalledTimes(1);
		view.stop();
	});

	it("calls onChange for everything when the ViewModel turned tracking off", () => {
		const viewModel = createLankaVM<IWatchedState, IWatchedActions>({
			name: "UntrackedSpecVM",
			enableAccessTrackingOptimization: false,
			states: { watched: 0, ignored: 0 },
			createActions: ({ set, get }) => ({
				bumpWatched: () => set({ watched: get().watched + 1 }),
				bumpIgnored: () => set({ ignored: get().ignored + 1 }),
			}),
		});
		const onChange = vi.fn();
		const view = createLankaViewSubscription(viewModel, onChange);
		void view.read().watched;

		viewModel.getState().bumpIgnored();

		expect(onChange).toHaveBeenCalledTimes(1);
		view.stop();
	});
});

describe("reading", () => {
	it("is LIVE, not a snapshot taken when the subscription opened", () => {
		// The shape that decides everything for a store-flavoured binding:
		// `store.load()` then `store.rows` must read what the action wrote, and a
		// captured state would hand back what was there before it ran.
		const viewModel = build();
		const view = createLankaViewSubscription(viewModel, () => undefined);

		viewModel.getState().bumpWatched();

		expect(view.read().watched).toBe(1);
		view.stop();
	});

	it("records what it is asked for, so the next change can be skipped", () => {
		const viewModel = build();
		const onChange = vi.fn();
		const view = createLankaViewSubscription(viewModel, onChange);

		void view.read().ignored;
		viewModel.getState().bumpWatched();

		expect(onChange).not.toHaveBeenCalled();
		view.stop();
	});
});

describe("stopping", () => {
	it("releases the subscription, and the ViewModel goes on living", () => {
		const viewModel = build();
		const onChange = vi.fn();
		const view = createLankaViewSubscription(viewModel, onChange);
		void view.read().watched;

		view.stop();
		viewModel.getState().bumpWatched();

		expect(onChange).not.toHaveBeenCalled();
		expect(viewModel.getState().watched).toBe(1);
	});

	it("gives each reader its own recording", () => {
		// Two readers of one ViewModel read different keys and must be woken for
		// different changes — which is why this is a factory with state of its own
		// rather than something held per store.
		const viewModel = build();
		const watching = vi.fn();
		const ignoring = vi.fn();
		const first = createLankaViewSubscription(viewModel, watching);
		const second = createLankaViewSubscription(viewModel, ignoring);
		void first.read().watched;
		void second.read().ignored;

		viewModel.getState().bumpWatched();

		expect(watching).toHaveBeenCalledTimes(1);
		expect(ignoring).not.toHaveBeenCalled();
		first.stop();
		second.stop();
	});
});

describe("a stateless ViewModel", () => {
	it("reads its actions and never wakes anybody", () => {
		// A stateless ViewModel has nothing that changes, so its `subscribe` hands
		// back an unsubscribe and calls nobody. That is what lets one binding serve
		// all three shapes without asking which it was handed.
		let called = 0;
		const viewModel = createStatelessLankaVM<{ announce: () => void }>({
			name: "StatelessSpecVM",
			createActions: () => ({
				announce: () => {
					called += 1;
				},
			}),
		});
		const onChange = vi.fn();
		const view = createLankaViewSubscription(viewModel, onChange);

		view.read().announce();

		expect(called).toBe(1);
		expect(onChange).not.toHaveBeenCalled();
		view.stop();
	});
});
