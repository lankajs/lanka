import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { toLankaSolidStore, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import {
	LANKA_STATELESS_VM_SHAPES,
	LANKA_VM_SHAPES,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import { createLankaFakeFormVM, createLankaFakeVM } from "@lankajs/tool-testing";

/**
 * The package, exercised as a consumer uses it.
 *
 * The same claims `@lankajs/react`'s and `@lankajs/vue`'s playgrounds make, in
 * the same words — reading them side by side should show only each framework's
 * own syntax.
 */
const titles = (): readonly string[] => ["write the canon", "run the canon"];

type TTodosVM = ReturnType<typeof createLankaFakeVM>;
type TFormVM = ReturnType<typeof createLankaFakeFormVM>;

/** The screen: reads the ViewModel through the binding, decides nothing. */
const TodoScreen = (props: { todosVM: TTodosVM; onRender?: () => void }) => {
	const state = useLankaVM(props.todosVM);

	return (
		<ul>
			{(() => {
				props.onRender?.();

				return state().rows.map((row) => <li>{row}</li>);
			})()}
		</ul>
	);
};

beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	resetActiveLanka();
});

describe("a screen reading a ViewModel", () => {
	it("renders what the ViewModel holds", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = render(() => <TodoScreen todosVM={todosVM} />);

		await todosVM.getState().load();

		expect(view.getByText("write the canon")).toBeTruthy();
		expect(view.getByText("run the canon")).toBeTruthy();
		view.unmount();
	});
});

describe("when a change is worth re-reading, and when it is not", () => {
	it("re-reads for a key the screen READ", async () => {
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = render(() => <TodoScreen todosVM={todosVM} onRender={onRender} />);
		const before = onRender.mock.calls.length;

		await todosVM.getState().load();

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
		view.unmount();
	});

	it("does NOT re-read for a key nothing read", () => {
		// The whole of access tracking in one scene. Solid would already skip work
		// a signal did not feed — but without tracking every change writes a new
		// object into the signal, and this expression reads it.
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = render(() => <TodoScreen todosVM={todosVM} onRender={onRender} />);
		const before = onRender.mock.calls.length;

		todosVM.getState().touchUnread();

		expect(onRender.mock.calls.length).toBe(before);
		view.unmount();
	});
});

describe("reading a ViewModel outside an owner", () => {
	it("hands the caller a stop", () => {
		// Solid releases a subscription with the owner it was made under. A read at
		// module level or in a plain function has none, and `onCleanup` would warn
		// rather than help — so `stop` is published. The same seam `@lankajs/vue`
		// and `@lankajs/svelte` have, named the same way.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const state = useLankaVM(todosVM as never);

		expect(typeof state.stop).toBe("function");
		state.stop();
	});
});

describe("rendering with a bootstrapped framework", () => {
	it("renders a component that needs a live instance, with no bootstrap in sight", () => {
		// What `@lankajs/solid/testing` is for, proved the way a consumer uses it.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = renderWithLanka(() => <TodoScreen todosVM={todosVM} />);

		expect(view.lanka).toBeDefined();
		expect(view.getByRole("list")).toBeTruthy();
		view.unmount();
	});

	it("hands every call a FRESH instance", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const first = renderWithLanka(() => <TodoScreen todosVM={todosVM} />);
		const second = renderWithLanka(() => <TodoScreen todosVM={todosVM} />);

		expect(second.lanka).not.toBe(first.lanka);
		first.unmount();
		second.unmount();
	});
});

describe("the store spelling, as a consumer writes it", () => {
	it("renders a member read with no call", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = () => {
			const todos = toLankaSolidStore(todosVM);

			return (
				<ul>
					{todos.rows.map((row) => (
						<li>{row}</li>
					))}
				</ul>
			);
		};

		const painted = render(() => <Screen />);
		await todosVM.getState().load();

		expect(painted.getByText("write the canon")).toBeTruthy();
	});
});

/**
 * A form screen: two inputs, one ViewModel key each, and one READER each.
 *
 * Two components rather than one, deliberately. A tracker belongs to whoever did
 * the reading, so a single component reading both keys is one reader of both and
 * is woken by either — which is correct, and is not the claim. What the scene
 * asserts is that two SEPARATE readers of one ViewModel are woken separately,
 * and that needs two of them.
 */
const CustomerInput = (props: { formVM: TFormVM; onRead?: () => void }) => {
	const state = useLankaVM(props.formVM);

	return (
		<input
			aria-label="customer"
			value={(() => {
				props.onRead?.();

				return state().customer;
			})()}
			onInput={(event) => state().setCustomer(event.currentTarget.value)}
		/>
	);
};

const NoteInput = (props: { formVM: TFormVM; onRead?: () => void }) => {
	const state = useLankaVM(props.formVM);

	return (
		<input
			aria-label="note"
			value={(() => {
				props.onRead?.();

				return state().note;
			})()}
			onInput={(event) => state().setNote(event.currentTarget.value)}
		/>
	);
};

const FormErrors = (props: { formVM: TFormVM }) => {
	const state = useLankaVM(props.formVM);

	return (
		<p role="alert">
			{state()
				.fieldErrors.filter((one) => one.path[0] === "customer")
				.map((one) => one.message)
				.join("")}
		</p>
	);
};

const FormScreen = (props: { formVM: TFormVM; onCustomer?: () => void; onNote?: () => void }) => (
	<form>
		<CustomerInput formVM={props.formVM} onRead={props.onCustomer} />
		<NoteInput formVM={props.formVM} onRead={props.onNote} />
		<FormErrors formVM={props.formVM} />
	</form>
);

describe("a screen that shows what went wrong", () => {
	it("shows the failure the ViewModel named", async () => {
		// The screen owns no error state and catches nothing: the ViewModel decided
		// what a failure means, and this reads the word it wrote.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = () => {
			const state = useLankaVM(todosVM);

			return <p role="alert">{state().error}</p>;
		};
		const view = render(() => <Screen />);

		todosVM.getState().fail("the relay is down");

		expect(view.getByRole("alert").textContent).toBe("the relay is down");
		view.unmount();
	});
});

describe("a ViewModel that turned tracking off", () => {
	it("re-reads for everything once the ViewModel turns tracking off", () => {
		// The documented remedy for the blind spot: a ViewModel that DERIVES what
		// the screen shows sets the flag false, and then every change counts —
		// including the one nothing read.
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles(), tracked: false });
		const view = render(() => <TodoScreen todosVM={todosVM} onRender={onRender} />);
		const before = onRender.mock.calls.length;

		todosVM.getState().touchUnread();

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
		view.unmount();
	});
});

describe("the subscription itself", () => {
	it("subscribes ONCE however many times the screen re-reads", async () => {
		// A subscription rebuilt per read is the failure measured in React at 201
		// subscriptions for 200 renders. Solid has no render loop to speak of, and
		// the claim is still worth making in its own vocabulary.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");
		const view = render(() => <TodoScreen todosVM={todosVM} />);

		await todosVM.getState().load();
		todosVM.getState().touchUnread();

		expect(subscribe).toHaveBeenCalledTimes(1);
		view.unmount();
	});
});

describe("a form whose inputs live in the ViewModel", () => {
	it("re-reads the input that changed and not its neighbour", () => {
		// Access tracking compares ROOT keys, which is the whole reason the form's
		// fields are two of them: a single `values` object would charge both inputs
		// for every keystroke.
		const formVM = createLankaFakeFormVM();
		const onCustomer = vi.fn();
		const onNote = vi.fn();
		const view = render(() => (
			<FormScreen formVM={formVM} onCustomer={onCustomer} onNote={onNote} />
		));
		const noteBefore = onNote.mock.calls.length;

		formVM.getState().setCustomer("Bo");

		expect(onCustomer.mock.calls.length).toBeGreaterThan(0);
		expect(onNote.mock.calls.length).toBe(noteBefore);
		view.unmount();
	});

	it("shows the refusal at the input's own address", async () => {
		const formVM = createLankaFakeFormVM();
		const view = render(() => <FormScreen formVM={formVM} />);

		formVM.getState().setCustomer("");
		await formVM.getState().submit();

		expect(view.getByRole("alert").textContent).toBe("customer is required");
		view.unmount();
	});
});

describe("reading through a selector", () => {
	it("re-reads when the SELECTOR's result changes, and not otherwise", async () => {
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = () => {
			const count = useLankaVM(todosVM, (state) => state.rows.length);

			return (
				<p>
					{(() => {
						onRender();

						return count();
					})()}
				</p>
			);
		};
		const view = render(() => <Screen />);
		const before = onRender.mock.calls.length;

		await todosVM.getState().load();

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
		view.unmount();
	});

	it("shows the selected value after a change that moved it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = () => {
			const count = useLankaVM(todosVM, (state) => state.rows.length);

			return <p>{count()}</p>;
		};
		const view = render(() => <Screen />);

		await todosVM.getState().load();

		expect(view.container.textContent).toBe("2");
		view.unmount();
	});
});

describe("the store spelling, over every shape a ViewModel comes in", () => {
	/*
	 * The conformance suite drives `useLankaVM`, which is not what this package's
	 * OWN idiom is. A store read with no call has to answer the same six shapes,
	 * and the list is the suite's so the two cannot drift.
	 */
	for (const shape of LANKA_VM_SHAPES) {
		it(`reads and updates over ${shape.name}`, () => {
			const viewModel = shape.build();
			const store = toLankaSolidStore(viewModel);

			(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();

			expect(store.watched).toBe(1);
			store.$stop();
		});
	}

	for (const shape of LANKA_STATELESS_VM_SHAPES) {
		it(`reads the actions of ${shape.name}`, () => {
			let called = 0;
			const store = toLankaSolidStore(
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
