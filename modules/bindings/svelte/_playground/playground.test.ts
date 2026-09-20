import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { screen } from "@testing-library/svelte";
import { derived, get } from "svelte/store";
import { toLankaSvelteVM, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import PlaygroundTodoScreen from "./playground-todo-screen/PlaygroundTodoScreen.svelte";
import PlaygroundDeclaredTodoScreen from "./playground-declared-todo-screen/PlaygroundDeclaredTodoScreen.svelte";
import PlaygroundLazyTodoScreen from "./playground-lazy-todo-screen/PlaygroundLazyTodoScreen.svelte";
import {
	playgroundVMBuildLog,
	usePlaygroundDeclaredTodosVM,
	usePlaygroundLazyTodosVM,
} from "./app";
import {
	LANKA_STATELESS_VM_SHAPES,
	LANKA_VM_SHAPES,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import {
	createLazyLankaVM,
	createLazyStatelessLankaVM,
	createStatelessLankaVM,
} from "lanka/viewmodel";
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

/**
 * Which declarations had already built a store by the time the suite started.
 *
 * Read here, at the test file's own module level, because that is the only
 * moment the question can be asked: `./app` is imported on the lines above, both
 * declarations run there, and the first `beforeEach` is already too late.
 */
const builtAtImport = [...playgroundVMBuildLog];

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

		const stop = toLankaSvelteVM(todosVM).subscribe((state) => seen.push(state.rows.length));

		expect(seen).toEqual([0]);
		stop();
	});

	it("feeds a derived store, which is the contract's real test", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const count = derived(toLankaSvelteVM(todosVM), (state) => state.rows.length);

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

		expect(count.current.rows).toBe(2);
		count.stop();
	});

	it("re-reads when the SELECTOR's result changes", async () => {
		// With a selector the selector decides and tracking is bypassed, so this is
		// the arm the scenes above do not reach.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];
		const count = useLankaVM(todosVM, (state) => ({ rows: state.rows.length }));

		const reader = mountPlaygroundReader(() => seen.push(count.current.rows));
		await todosVM.getState().load();
		flushSync();

		expect(seen.at(-1)).toBe(2);
		reader.unmount();
		count.stop();
	});
});

describe("a ViewModel declared through the binding's own factory", () => {
	/**
	 * The declaration a consumer writes now, and the one thing the scenes above
	 * cannot show.
	 *
	 * Every one of them builds a ViewModel inside a test and reads it there. What
	 * `createLankaVM` from THIS package is for is the other shape: one line at
	 * module level, imported by a component that takes no props at all. The
	 * factory ran at import, outside every effect, and the subscription is opened
	 * by the component's own read.
	 */
	beforeEach(() => {
		usePlaygroundDeclaredTodosVM.setState(usePlaygroundDeclaredTodosVM.getInitialState());
	});

	it("renders what the declaration holds, and then what an action wrote", () => {
		renderWithLanka(PlaygroundDeclaredTodoScreen);

		expect(screen.getByRole("heading").textContent).toBe("the canon");
		expect(screen.queryAllByRole("listitem")).toHaveLength(0);

		usePlaygroundDeclaredTodosVM.getState().load();
		flushSync();

		expect(screen.getByText("write the canon")).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("is still the ViewModel, so a loader reads it with no component", () => {
		usePlaygroundDeclaredTodosVM.getState().load();

		expect(usePlaygroundDeclaredTodosVM.getState().titles).toHaveLength(2);
		expect(usePlaygroundDeclaredTodosVM.name).toBe("PlaygroundDeclaredTodosVM");
	});
});

describe("a LAZY ViewModel declared through the binding's own factory", () => {
	it("built nothing at the declaration, nor to answer its own name", () => {
		// The claim `createLazyLankaVM` is wrapped for, asserted where it happens.
		// Its eager neighbour built its store at import — so the log proves it can
		// see a build at all — and this one did not, although the same module was
		// imported at the same moment.
		expect(builtAtImport).toContain("PlaygroundDeclaredTodosVM");
		expect(builtAtImport).not.toContain("PlaygroundLazyTodosVM");

		expect(usePlaygroundLazyTodosVM.name).toBe("PlaygroundLazyTodosVM");
		expect(playgroundVMBuildLog).not.toContain("PlaygroundLazyTodosVM");
	});

	it("still reads from a component, and the store arrives then", () => {
		renderWithLanka(PlaygroundLazyTodoScreen);

		expect(playgroundVMBuildLog).toContain("PlaygroundLazyTodosVM");
		expect(screen.getByRole("heading").textContent).toBe("the canon, lazily");

		usePlaygroundLazyTodosVM.getState().load();
		flushSync();

		expect(screen.getByText("write the canon")).toBeTruthy();
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
			const stop = toLankaSvelteVM(viewModel).subscribe((state) => seen.push(state.watched));

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
			const store = toLankaSvelteVM(viewModel);

			get(store).announce();

			expect(called).toBe(1);
		});
	}
});

describe("over a LAZY ViewModel, which is what a real application declares", () => {
	const buildLazy = () =>
		createLazyLankaVM<{ watched: number }, { bump: () => void }>({
			name: "LazySvelteVM",
			states: { watched: 0 },
			createActions: ({ set, get }) => ({ bump: () => set({ watched: get().watched + 1 }) }),
		});

	it("answers its name without building the store", () => {
		const viewModel = buildLazy();

		expect(viewModel.name).toBe("LazySvelteVM");
		expect(typeof viewModel.dispose).toBe("function");
	});

	it("reads and updates through the store contract", () => {
		const viewModel = buildLazy();
		const seen: number[] = [];
		const stop = toLankaSvelteVM(viewModel).subscribe((state) => seen.push(state.watched));

		viewModel.getState().bump();

		expect(seen.at(-1)).toBe(1);
		stop();
	});
});

describe("over a STATELESS ViewModel, which has no state to read", () => {
	it("reads its actions and is never woken", () => {
		let called = 0;
		const viewModel = createStatelessLankaVM<{ announce: () => void }>({
			name: "StatelessSvelteVM",
			createActions: () => ({
				announce: () => {
					called += 1;
				},
			}),
		});
		const seen: { announce: () => void }[] = [];
		const stop = toLankaSvelteVM(viewModel).subscribe((state) => seen.push(state));

		seen[0]?.announce();

		expect(called).toBe(1);
		expect(seen).toHaveLength(1);
		stop();
	});

	it("reads a LAZY stateless ViewModel the same way", () => {
		let called = 0;
		const viewModel = createLazyStatelessLankaVM<{ announce: () => void }>({
			name: "LazyStatelessSvelteVM",
			createActions: () => ({
				announce: () => {
					called += 1;
				},
			}),
		});
		const seen: { announce: () => void }[] = [];
		const stop = toLankaSvelteVM(viewModel).subscribe((state) => seen.push(state));

		seen[0]?.announce();

		expect(called).toBe(1);
		stop();
	});
});
