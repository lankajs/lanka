import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { derived, get } from "svelte/store";
import { toLankaSvelteStore, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import PlaygroundTodoScreen from "./playground-todo-screen/PlaygroundTodoScreen.svelte";
import {
	LANKA_STATELESS_VM_SHAPES,
	LANKA_VM_SHAPES,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import { createLankaFakeFormVM, createLankaFakeVM } from "@lankajs/tool-testing";
import { mountPlaygroundReader } from "./mount-playground-reader/mountPlaygroundReader.svelte";
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

describe("a view that shows what went wrong", () => {
	it("shows the failure the ViewModel named", () => {
		// The view owns no error state and catches nothing: the ViewModel decided
		// what a failure means, and this reads the word it wrote.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = useLankaVM(todosVM);

		todosVM.getState().fail("the relay is down");
		flushSync();

		expect(view.error).toBe("the relay is down");
		view.stop();
	});
});

describe("a ViewModel that turned tracking off", () => {
	it("re-runs for everything once the ViewModel turns tracking off", async () => {
		// The documented remedy for the blind spot: a ViewModel that DERIVES what
		// the view shows sets the flag false, and then every change counts —
		// including the one nothing read.
		const todosVM = createLankaFakeVM({ rows: titles(), tracked: false });
		const mounted = mountPlaygroundView(todosVM as never, (state) => {
			void (state as unknown as { rows: unknown }).rows;
		});
		const before = mounted.renders();

		todosVM.getState().touchUnread();
		flushSync();

		expect(mounted.renders()).toBeGreaterThan(before);
		mounted.unmount();
	});
});

describe("the subscription itself", () => {
	it("subscribes ONCE however many times the view re-reads", async () => {
		// A subscription rebuilt per read is the failure measured in React at 201
		// subscriptions for 200 renders. Svelte has no render loop of that shape,
		// and the claim is still worth making in its own vocabulary.
		//
		// The reader has to READ: `createSubscriber` opens the subscription lazily,
		// on the first read inside an effect, which is Svelte doing exactly what it
		// promises and is why an empty reader subscribes to nothing at all.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");
		const mounted = mountPlaygroundView(todosVM as never, (state) => {
			void (state as unknown as { rows: unknown }).rows;
		});

		await todosVM.getState().load();
		flushSync();
		todosVM.getState().touchUnread();
		flushSync();

		expect(subscribe).toHaveBeenCalledTimes(1);
		mounted.unmount();
	});
});

describe("a form whose inputs live in the ViewModel", () => {
	it("re-runs the reader whose field changed and not its neighbour", () => {
		// Access tracking compares ROOT keys, which is the whole reason the form's
		// fields are two of them: a single `values` object would charge both readers
		// for every keystroke.
		const formVM = createLankaFakeFormVM();
		const customerView = useLankaVM(formVM);
		const noteView = useLankaVM(formVM);
		const customer = mountPlaygroundReader(() => void customerView.customer);
		const note = mountPlaygroundReader(() => void noteView.note);
		const customerBefore = customer.reads();
		const noteBefore = note.reads();

		formVM.getState().setCustomer("Bo");
		flushSync();

		expect(customer.reads()).toBeGreaterThan(customerBefore);
		expect(note.reads()).toBe(noteBefore);
		customer.unmount();
		note.unmount();
		customerView.stop();
		noteView.stop();
	});

	it("shows the refusal at the input's own address", async () => {
		const formVM = createLankaFakeFormVM();
		const view = useLankaVM(formVM);

		formVM.getState().setCustomer("");
		await formVM.getState().submit();
		flushSync();

		expect([...view.fieldErrors]).toEqual([
			{ path: ["customer"], message: "customer is required" },
		]);
		view.stop();
	});
});

describe("reading through a selector", () => {
	it("shows the selected value after a change that moved it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const count = useLankaVM(todosVM, (state) => ({ rows: state.rows.length }));

		await todosVM.getState().load();
		flushSync();

		expect(count.rows).toBe(2);
		count.stop();
	});

	it("re-reads when the SELECTOR's result changes", async () => {
		// With a selector the selector decides and tracking is bypassed, so this is
		// the arm the scenes above do not reach.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];
		const count = useLankaVM(todosVM, (state) => ({ rows: state.rows.length }));

		const reader = mountPlaygroundReader(() => seen.push(count.rows));
		await todosVM.getState().load();
		flushSync();

		expect(seen.at(-1)).toBe(2);
		reader.unmount();
		count.stop();
	});
});

describe("the store contract, over every shape a ViewModel comes in", () => {
	/*
	 * The conformance suite drives `useLankaVM`, which is not what this package's
	 * OWN idiom is. A `$store` has to answer the same six shapes, and the list is
	 * the suite's so the two cannot drift.
	 */
	for (const shape of LANKA_VM_SHAPES) {
		it(`reads and updates over ${shape.name}`, () => {
			const viewModel = shape.build();
			const seen: number[] = [];
			const stop = toLankaSvelteStore(viewModel).subscribe((state) =>
				seen.push(state.watched),
			);

			(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();

			expect(seen.at(-1)).toBe(1);
			stop();
		});
	}

	for (const shape of LANKA_STATELESS_VM_SHAPES) {
		it(`reads the actions of ${shape.name}`, () => {
			let called = 0;
			const viewModel = shape.build(() => {
				called += 1;
			});
			const store = toLankaSvelteStore(viewModel);

			get(store).announce();

			expect(called).toBe(1);
		});
	}
});
