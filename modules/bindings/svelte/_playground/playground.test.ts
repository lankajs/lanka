import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { derived, get } from "svelte/store";
import { toLankaSvelteStore, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import PlaygroundTodoScreen from "./playground-todo-screen/PlaygroundTodoScreen.svelte";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { mountPlaygroundView } from "./mount-playground-view/mountPlaygroundView.svelte";

/**
 * The package, exercised as a consumer uses it.
 *
 * The same claims `@lankajs/react`'s and `@lankajs/vue`'s playgrounds make, in
 * the same words — reading them side by side should show only each framework's
 * own syntax.
 */
const titles = (): readonly string[] => ["write the canon", "run the canon"];

beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	resetActiveLanka();
});

describe("a view reading a ViewModel", () => {
	it("shows what the ViewModel holds", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = useLankaVM(todosVM);

		expect(view.rows).toEqual([]);
		expect(view.isLoading).toBe(false);
		view.stop();
	});

	it("shows what an action wrote", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = useLankaVM(todosVM);

		await todosVM.getState().load();
		flushSync();

		expect([...view.rows]).toEqual([...titles()]);
		view.stop();
	});
});

describe("when a change is worth re-reading, and when it is not", () => {
	it("re-runs an effect for a key it READ", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: unknown[] = [];
		const mounted = mountPlaygroundView(todosVM as never, (state) => {
			seen.push((state as unknown as { rows: unknown }).rows);
		});
		const before = mounted.renders();

		await todosVM.getState().load();
		flushSync();

		expect(mounted.renders()).toBeGreaterThan(before);
		mounted.unmount();
	});

	it("does NOT re-run for a key nothing read", () => {
		// The whole of access tracking in one scene: `unread` moves, no effect ever
		// looked at it, and nothing re-runs.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const mounted = mountPlaygroundView(todosVM as never, (state) => {
			void (state as unknown as { rows: unknown }).rows;
		});
		const before = mounted.renders();

		todosVM.getState().touchUnread();
		flushSync();

		expect(mounted.renders()).toBe(before);
		mounted.unmount();
	});
});

describe("reading a ViewModel where no effect will ever read it", () => {
	it("hands the caller a stop", () => {
		// `createSubscriber` releases the subscription when the last effect reading
		// this view is destroyed. A read with no effect at all — a module-level
		// snapshot, a script — has none, so `stop` is published and the caller owns
		// it. The same seam `@lankajs/vue` and `@lankajs/solid` have, for the same
		// reason, and named the same way.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = useLankaVM(todosVM);

		expect(typeof view.stop).toBe("function");
		view.stop();
	});
});

describe("rendering with a bootstrapped framework", () => {
	it("renders a component that needs a live instance, with no bootstrap in sight", () => {
		// A real `.svelte` component, compiled by the plugin the vitest config
		// carries. The package's own `src/` needs no compiler — `createSubscriber`
		// is plain TypeScript — but what `renderWithLanka` renders IS a component,
		// and proving the subpath with anything less would prove something else.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = renderWithLanka(PlaygroundTodoScreen, { props: { todosVM } });

		expect(view.lanka).toBeDefined();
	});

	it("hands every call a FRESH instance", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const first = renderWithLanka(PlaygroundTodoScreen, { props: { todosVM } });
		const second = renderWithLanka(PlaygroundTodoScreen, { props: { todosVM } });

		expect(second.lanka).not.toBe(first.lanka);
	});
});

describe("the store contract, as a consumer writes it", () => {
	it("hands a value to a subscriber immediately, which is what `$` needs", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];

		const stop = toLankaSvelteStore(todosVM).subscribe((state) => seen.push(state.rows.length));

		expect(seen).toEqual([0]);
		stop();
	});

	it("feeds a derived store, which is the contract's real test", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const count = derived(toLankaSvelteStore(todosVM), (state) => state.rows.length);

		await todosVM.getState().load();

		expect(get(count)).toBe(2);
	});
});
