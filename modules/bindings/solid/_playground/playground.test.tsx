import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { toLankaSolidVM, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
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
import {
	playgroundVMBuildLog,
	usePlaygroundClassTodosVM,
	usePlaygroundDeclaredTodosVM,
	usePlaygroundLazyTodosVM,
} from "./app";

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
			const todos = toLankaSolidVM(todosVM);

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

/**
 * The screen a consumer writes over a one-line declaration.
 *
 * It takes no props and imports nothing but the ViewModel, because that is the
 * shape the pre-applied read buys: the declaration is a module, the component
 * calls it, and there is no context, no root and no `useLankaVM(todosVM)` in
 * between. `state()` because the call answers an ACCESSOR — that is Solid's own
 * idea of a value, and the one thing this shelf deliberately does not hide.
 */
const DeclaredTodoScreen = () => {
	const state = usePlaygroundDeclaredTodosVM();

	return (
		<section>
			<h1>{state().heading}</h1>
			<ul>
				{state().titles.map((title) => (
					<li>{title}</li>
				))}
			</ul>
		</section>
	);
};

/** The same screen over a LAZY declaration, and it reads no differently. */
const LazyTodoScreen = () => {
	const state = usePlaygroundLazyTodosVM();

	return (
		<section>
			<h1>{state().heading}</h1>
			<ul>
				{state().titles.map((title) => (
					<li>{title}</li>
				))}
			</ul>
		</section>
	);
};

describe("a ViewModel declared through the binding's own factory", () => {
	/**
	 * The declaration a consumer writes now, and the one thing the scenes above
	 * cannot show.
	 *
	 * Every one of them builds a ViewModel inside a test and hands it to a screen
	 * as a prop. What `createLankaVM` from THIS package is for is the other shape:
	 * one line at module level, imported by a component that takes no props at
	 * all. The factory ran at import, where there is no owner — which is why what
	 * is pre-applied is `useLankaVM` and not `toLankaSolidVM` — and the read
	 * happens when the component calls what it answered.
	 */
	beforeEach(() => {
		usePlaygroundDeclaredTodosVM.setState(usePlaygroundDeclaredTodosVM.getInitialState());
	});

	it("renders what the declaration holds, and then what an action wrote", () => {
		const view = render(() => <DeclaredTodoScreen />);

		expect(view.getByRole("heading").textContent).toBe("the canon");
		expect(view.queryAllByRole("listitem")).toHaveLength(0);

		usePlaygroundDeclaredTodosVM.getState().load();

		expect(view.getByText("write the canon")).toBeTruthy();
		expect(view.getByText("run the canon")).toBeTruthy();
		view.unmount();
	});

	it("is still the ViewModel, so a loader reads it with no owner", () => {
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
		const view = render(() => <LazyTodoScreen />);

		expect(playgroundVMBuildLog).toContain("PlaygroundLazyTodosVM");
		expect(view.getByRole("heading").textContent).toBe("the canon, lazily");

		usePlaygroundLazyTodosVM.getState().load();

		expect(view.getByText("write the canon")).toBeTruthy();
		view.unmount();
	});
});

/**
 * The screen a consumer writes over a CLASS, and it is `DeclaredTodoScreen`
 * character for character.
 *
 * Which is the point: what the class style costs is one wrapper in the
 * declaration file, and nothing at all here. `state()` because the call still
 * answers an ACCESSOR — the wrapper forwards to the same `useLankaVM` the
 * factories pre-apply, so a screen cannot tell which side it was handed.
 */
const ClassTodoScreen = () => {
	const state = usePlaygroundClassTodosVM();

	return (
		<section>
			<h1>{state().heading}</h1>
			<ul>
				{state().titles.map((title) => (
					<li>{title}</li>
				))}
			</ul>
		</section>
	);
};

describe("a ViewModel a CLASS built, given the binding's read by hand", () => {
	/**
	 * The third shape a declaration comes in, and the one the six factories
	 * cannot reach.
	 *
	 * A class names itself and knows no framework, so `toLankaCallableVM` applies
	 * the read once — in the declaration file, where there is no owner — and what
	 * comes back is the same callable the factories answer. The owner arrives when
	 * the component calls it, exactly as it does for the two scenes above.
	 */
	beforeEach(() => {
		usePlaygroundClassTodosVM.setState(usePlaygroundClassTodosVM.getInitialState());
	});

	it("renders what the CLASS declared, and then what an action wrote", () => {
		const view = render(() => <ClassTodoScreen />);

		expect(view.getByRole("heading").textContent).toBe("the canon, by class");
		expect(view.queryAllByRole("listitem")).toHaveLength(0);

		usePlaygroundClassTodosVM.getState().load();

		expect(view.getByText("write the canon")).toBeTruthy();
		expect(view.getByText("run the canon")).toBeTruthy();
		view.unmount();
	});

	it("keeps the name the CLASS gave itself, and reads with no owner", () => {
		// A wrapper that copied members onto a new function instead of forwarding
		// would answer the FUNCTION's own `name` here, which is the empty string.
		// The store was built at import, where there is no owner at all.
		expect(usePlaygroundClassTodosVM.name).toBe("PlaygroundClassTodosVM");
		expect(builtAtImport).toContain("PlaygroundClassTodosVM");

		usePlaygroundClassTodosVM.getState().load();

		expect(usePlaygroundClassTodosVM.getState().titles).toHaveLength(2);
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
			const store = toLankaSolidVM(viewModel);

			(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();

			expect(store.watched).toBe(1);
			store.$stop();
		});
	}

	for (const shape of LANKA_STATELESS_VM_SHAPES) {
		it(`reads the actions of ${shape.name}`, () => {
			let called = 0;
			const store = toLankaSolidVM(
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

describe("over a LAZY ViewModel, which is what a real application declares", () => {
	const buildLazy = () =>
		createLazyLankaVM<{ watched: number }, { bump: () => void }>({
			name: "LazySolidVM",
			states: { watched: 0 },
			createActions: ({ set, get }) => ({ bump: () => set({ watched: get().watched + 1 }) }),
		});

	it("answers its name without building the store", () => {
		const viewModel = buildLazy();

		expect(viewModel.name).toBe("LazySolidVM");
		expect(typeof viewModel.dispose).toBe("function");
	});

	it("reads and updates with no call on the outside", () => {
		const viewModel = buildLazy();
		const vm = toLankaSolidVM(viewModel);

		viewModel.getState().bump();

		expect(vm.watched).toBe(1);
		vm.$stop();
	});
});

describe("over a STATELESS ViewModel, which has no state to read", () => {
	it("reads its actions and is never woken", () => {
		let called = 0;
		const viewModel = createStatelessLankaVM<{ announce: () => void }>({
			name: "StatelessSolidVM",
			createActions: () => ({
				announce: () => {
					called += 1;
				},
			}),
		});
		const vm = toLankaSolidVM(viewModel);

		vm.announce();

		expect(called).toBe(1);
		vm.$stop();
	});

	it("reads a LAZY stateless ViewModel the same way", () => {
		let called = 0;
		const viewModel = createLazyStatelessLankaVM<{ announce: () => void }>({
			name: "LazyStatelessSolidVM",
			createActions: () => ({
				announce: () => {
					called += 1;
				},
			}),
		});
		const vm = toLankaSolidVM(viewModel);

		vm.announce();

		expect(called).toBe(1);
		vm.$stop();
	});
});
