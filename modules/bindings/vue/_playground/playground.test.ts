import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import { defineComponent, h, nextTick } from "vue";
import { defineLankaStore, lankaStoreToRefs, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	LANKA_STATELESS_VM_SHAPES,
	LANKA_VM_SHAPES,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import { createLankaFakeFormVM, createLankaFakeVM } from "@lankajs/tool-testing";
import { PlaygroundRenameScreen, PlaygroundTodoScreen } from "./app";

/**
 * The package, exercised as a consumer uses it.
 *
 * Deliberately the same scenes as `@lankajs/react`'s playground, in the same
 * order and the same words. Two playgrounds asserting the same sentences about
 * the same ViewModels is what a `parallel` shelf means, and reading them side by
 * side should show only Vue's and React's own syntax.
 */
const titles = (): readonly string[] => ["write the canon", "run the canon"];

beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	cleanup();
	resetActiveLanka();
});

describe("a screen reading a ViewModel", () => {
	it("renders what the ViewModel holds", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(PlaygroundTodoScreen, { props: { todosVM } });
		await todosVM.getState().load();
		await nextTick();

		expect(screen.getByText("write the canon")).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(PlaygroundTodoScreen, { props: { todosVM } });
		await todosVM.getState().load();
		todosVM.getState().fail("gone");
		await nextTick();

		expect(screen.getByRole("alert").textContent).toBe("gone");
	});

	it("shows the failure the ViewModel named", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(PlaygroundTodoScreen, { props: { todosVM } });
		todosVM.getState().fail("no such todo");
		await nextTick();

		expect(screen.getByRole("alert").textContent).toBe("no such todo");
	});
});

describe("when a change is worth a render, and when it is not", () => {
	it("re-renders for a key the screen READ", async () => {
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(PlaygroundTodoScreen, { props: { todosVM, onRender } });
		const before = onRender.mock.calls.length;

		await todosVM.getState().load();
		await nextTick();

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
	});

	it("does NOT re-render for a key nothing read", async () => {
		// The whole of access tracking in one scene: `unread` moves, no component
		// ever looked at it, and nothing repaints.
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(PlaygroundTodoScreen, { props: { todosVM, onRender } });
		const before = onRender.mock.calls.length;

		todosVM.getState().touchUnread();
		await nextTick();

		expect(onRender.mock.calls.length).toBe(before);
	});

	it("re-renders for everything once the ViewModel turns tracking off", async () => {
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles(), tracked: false });

		render(PlaygroundTodoScreen, { props: { todosVM, onRender } });
		const before = onRender.mock.calls.length;

		todosVM.getState().touchUnread();
		await nextTick();

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
	});

	it("subscribes ONCE however many times a component re-renders", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");

		render(PlaygroundTodoScreen, { props: { todosVM } });
		for (let index = 0; index < 20; index += 1) {
			todosVM.getState().touchUnread();
			await nextTick();
		}

		expect(subscribe).toHaveBeenCalledTimes(1);
	});
});

describe("a form whose inputs live in the ViewModel", () => {
	it("re-renders the input that changed and not its neighbour", async () => {
		const renameVM = createLankaFakeFormVM();
		const onCustomerRender = vi.fn();
		const onNoteRender = vi.fn();

		render(PlaygroundRenameScreen, {
			props: { renameVM, onCustomerRender, onNoteRender },
		});
		const customerBefore = onCustomerRender.mock.calls.length;
		const noteBefore = onNoteRender.mock.calls.length;

		renameVM.getState().setCustomer("Al");
		await nextTick();

		// Flat keys: `customer` moved, `note` did not, and only the reader of
		// `customer` paid. One `values` object would have charged both.
		expect(onCustomerRender.mock.calls.length).toBe(customerBefore + 1);
		expect(onNoteRender.mock.calls.length).toBe(noteBefore);
	});

	it("shows the refusal at the input's own address", async () => {
		const renameVM = createLankaFakeFormVM();

		render(PlaygroundRenameScreen, { props: { renameVM } });
		renameVM.getState().setCustomer("   ");
		await renameVM.getState().submit();
		await nextTick();

		expect(screen.getByRole("alert").textContent).toBe("customer is required");
	});
});

describe("reading a ViewModel outside a component", () => {
	it("hands the caller a stop, because there is no scope to attach to", () => {
		// Vue releases a subscription with the effect scope it was made in. A read
		// at module level or in a plain function has none, and `onScopeDispose`
		// would warn rather than help — so `stop` is published and the caller owns
		// it. React has no equivalent because a hook cannot be called outside one.
		const todosVM = createLankaFakeVM({ rows: titles() });

		const state = useLankaVM(todosVM);

		expect(typeof state.stop).toBe("function");
		state.stop();
	});
});

describe("rendering with a bootstrapped framework", () => {
	it("renders a component that needs a live instance, with no bootstrap in sight", () => {
		// What `@lankajs/vue/testing` is for, proved the way a consumer uses it.
		// Without an instance the first locator access inside a ViewModel throws,
		// and assembling bootstrap in every component test is the preamble this
		// removes.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = renderWithLanka(PlaygroundTodoScreen, { props: { todosVM } });

		expect(view.lanka).toBeDefined();
		expect(screen.getByRole("list")).toBeTruthy();
	});

	it("hands every call a FRESH instance", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const first = renderWithLanka(PlaygroundTodoScreen, { props: { todosVM } });
		const second = renderWithLanka(PlaygroundTodoScreen, { props: { todosVM } });

		expect(second.lanka).not.toBe(first.lanka);
	});
});

describe("the Pinia spelling, as a consumer writes it", () => {
	it("renders a member read straight off the store", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = defineComponent({
			setup() {
				const todos = defineLankaStore(todosVM);

				return () =>
					h(
						"ul",
						todos.rows.map((row) => h("li", { key: row }, row)),
					);
			},
		});

		render(Screen);
		await todosVM.getState().load();
		await nextTick();

		expect(screen.getByText("write the canon")).toBeTruthy();
	});

	it("renders through a destructured name, which needs the refs", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = defineComponent({
			setup() {
				const { rows } = lankaStoreToRefs(defineLankaStore(todosVM));

				return () =>
					h(
						"ul",
						rows.value.map((row) => h("li", { key: row }, row)),
					);
			},
		});

		render(Screen);
		await todosVM.getState().load();
		await nextTick();

		expect(screen.getByText("run the canon")).toBeTruthy();
	});
});

describe("reading through a selector", () => {
	it("re-renders when the SELECTOR's result changes, and not otherwise", async () => {
		// With a selector the selector decides and tracking is bypassed, so this is
		// the arm every scene above leaves untouched.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const onRender = vi.fn();
		const Screen = defineComponent({
			setup() {
				const count = useLankaVM(todosVM, (state) => state.rows.length);

				return () => {
					onRender();

					return h("p", String(count.value));
				};
			},
		});
		render(Screen);
		await nextTick();
		const before = onRender.mock.calls.length;

		await todosVM.getState().load();
		await nextTick();

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
	});

	it("shows the selected value after a change that moved it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = defineComponent({
			setup() {
				const count = useLankaVM(todosVM, (state) => state.rows.length);

				return () => h("p", String(count.value));
			},
		});
		render(Screen);

		await todosVM.getState().load();
		await nextTick();

		expect(screen.getByText("2")).toBeTruthy();
	});
});

describe("the Pinia spelling, over every shape a ViewModel comes in", () => {
	/*
	 * The conformance suite drives `useLankaVM` through `mount`, which is not what
	 * this package's OWN idiom is. A store read with no `.value` has to answer the
	 * same six shapes, and the list is the suite's so the two cannot drift.
	 */
	for (const shape of LANKA_VM_SHAPES) {
		it(`reads and updates over ${shape.name}`, async () => {
			const viewModel = shape.build();
			const store = defineLankaStore(viewModel);

			(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();
			await nextTick();

			expect(store.watched).toBe(1);
			store.$stop();
		});
	}

	for (const shape of LANKA_STATELESS_VM_SHAPES) {
		it(`reads the actions of ${shape.name}`, () => {
			let called = 0;
			const store = defineLankaStore(
				shape.build(() => {
					called += 1;
				}),
			);

			store.announce();

			expect(called).toBe(1);
			store.$stop();
		});
	}
});
