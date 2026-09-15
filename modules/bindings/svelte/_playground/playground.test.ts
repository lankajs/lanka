import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { useLankaVM } from "../src/index";
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

		expect(view.rows.map((todo) => todo.title)).toEqual(["write the canon", "run the canon"]);
		view.stop();
	});
});

describe("when a change is worth re-reading, and when it is not", () => {
	it("re-runs an effect for a key it READ", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: unknown[] = [];
		const mounted = mountPlaygroundView(todosVM as never, (state) => {
			seen.push((state as unknown as { todos: unknown }).rows);
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
			void (state as unknown as { todos: unknown }).rows;
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
