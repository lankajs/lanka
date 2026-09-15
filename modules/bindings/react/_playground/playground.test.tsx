import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { createLankaHost, getLankaHost } from "lanka/config";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaFakeFormVM, createLankaFakeVM } from "@lankajs/tool-testing";
import {
	LANKA_STATELESS_VM_SHAPES,
	LANKA_VM_SHAPES,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import { toLankaReactVM, useLankaShallow, useLankaVM } from "../src/index";
import {
	createPlaygroundOrderEditVM,
	PlaygroundFormikScreen,
	PlaygroundHookFormScreen,
	PlaygroundRenameScreen,
	PlaygroundTanstackFormScreen,
	PlaygroundTodoScreen,
	PlaygroundCallableTodoScreen,
} from "./app";
import type { IPlaygroundOrderServer } from "./app";
import type { ILankaFakeVMState } from "@lankajs/tool-testing";
import type { JSX } from "react";

/**
 * The package, exercised as a consumer uses it.
 *
 * What only a RENDERER can prove: that a screen reads a ViewModel, that it
 * re-renders for the keys it read and for no others, that a selector overrides
 * that, and that a form library sits on top of the same ViewModel. Everything
 * under those — the transport, the gateway, the scenarios, the validation — is
 * proved framework-free in core's playground, and a second copy here would be a
 * second subject rather than more coverage.
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

		render(<PlaygroundTodoScreen todosVM={todosVM} />);
		await act(async () => {
			await todosVM.getState().load();
		});

		expect(screen.getByText("write the canon")).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(<PlaygroundTodoScreen todosVM={todosVM} />);
		await act(async () => {
			await todosVM.getState().load();
		});

		act(() => {
			todosVM.getState().fail("gone");
		});

		expect(screen.getByRole("alert").textContent).toBe("gone");
	});

	it("shows the failure the ViewModel named", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(<PlaygroundTodoScreen todosVM={todosVM} />);
		act(() => {
			todosVM.getState().fail("no such todo");
		});

		expect(screen.getByRole("alert").textContent).toBe("no such todo");
	});
});

describe("when a change is worth a render, and when it is not", () => {
	it("re-renders for a key the screen READ", async () => {
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(<PlaygroundTodoScreen todosVM={todosVM} onRender={onRender} />);
		const before = onRender.mock.calls.length;

		await act(async () => {
			await todosVM.getState().load();
		});

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
	});

	it("does NOT re-render for a key nothing read", () => {
		// The whole of access tracking in one scene: `unread` moves, no component
		// ever looked at it, and nothing repaints.
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });

		render(<PlaygroundTodoScreen todosVM={todosVM} onRender={onRender} />);
		const before = onRender.mock.calls.length;

		act(() => {
			todosVM.getState().touchUnread();
		});

		expect(onRender.mock.calls.length).toBe(before);
	});

	it("re-renders for everything once the ViewModel turns tracking off", () => {
		// A ViewModel that DERIVES what the screen shows says so, and the binding
		// obeys it: the alternative is a frozen screen with no error anywhere.
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles(), tracked: false });

		render(<PlaygroundTodoScreen todosVM={todosVM} onRender={onRender} />);
		const before = onRender.mock.calls.length;

		act(() => {
			todosVM.getState().touchUnread();
		});

		expect(onRender.mock.calls.length).toBeGreaterThan(before);
	});

	it("subscribes ONCE however many times a component re-renders", () => {
		// The defect this guards: keying the subscription on an inline selector or
		// on a fresh arrow tears it down and rebuilds it every render — measured
		// once at 201 subscriptions for 200 renders.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");

		const { rerender } = render(<PlaygroundTodoScreen todosVM={todosVM} />);
		for (let index = 0; index < 20; index += 1) {
			rerender(<PlaygroundTodoScreen todosVM={todosVM} />);
		}

		expect(subscribe).toHaveBeenCalledTimes(1);
	});
});

describe("the callable spelling, which is the same screen", () => {
	/**
	 * What a consumer arriving from 1.x writes.
	 *
	 * Every scene here has a twin above driving `PlaygroundTodoScreen` through
	 * `useLankaVM`. That is the point: the two spellings must answer the same, or
	 * the façade has become a second reading of the ViewModel rather than a
	 * spelling of the first.
	 */
	it("renders what the ViewModel holds", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const useTodosVM = toLankaReactVM(todosVM);

		render(<PlaygroundCallableTodoScreen useTodosVM={useTodosVM} />);
		await act(async () => {
			await todosVM.getState().load();
		});

		expect(screen.getByText("write the canon")).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("re-renders for the keys it read and for no others", async () => {
		// The claim the whole shelf rests on, asked of the façade: access tracking
		// is core's, so wrapping a ViewModel must not spend it.
		const onRender = vi.fn();
		const todosVM = createLankaFakeVM({ rows: titles() });
		const useTodosVM = toLankaReactVM(todosVM);

		render(<PlaygroundCallableTodoScreen useTodosVM={useTodosVM} onRender={onRender} />);
		await act(async () => {
			await todosVM.getState().load();
		});
		const afterLoad = onRender.mock.calls.length;

		act(() => todosVM.setState({ untouched: "moved" }));

		expect(onRender.mock.calls.length).toBe(afterLoad);
	});

	it("reads the same store the portable spelling reads", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const useTodosVM = toLankaReactVM(todosVM);

		render(
			<>
				<PlaygroundTodoScreen todosVM={todosVM} />
				<PlaygroundCallableTodoScreen useTodosVM={useTodosVM} />
			</>,
		);
		await act(async () => {
			await todosVM.getState().load();
		});

		// One store, two screens, two spellings — and both saw the same load.
		expect(screen.getAllByText("write the canon")).toHaveLength(2);
	});

	it("still answers getState outside a component, as a loader would ask", () => {
		const useTodosVM = toLankaReactVM(createLankaFakeVM({ rows: titles() }));

		expect(useTodosVM.getState().rows).toEqual([]);
		expect(useTodosVM.name).toBe("LankaFakeVM");
	});
});

describe("the callable spelling, over every shape a ViewModel comes in", () => {
	/*
	 * The conformance suite drives `useLankaVM` through `mount`, which is not what
	 * this package's OWN idiom is. A callable ViewModel has to answer the same six
	 * shapes, and the list is the suite's so the two cannot drift.
	 */
	for (const shape of LANKA_VM_SHAPES) {
		it(`reads and re-renders over ${shape.name}`, () => {
			const viewModel = shape.build();
			const useVM = toLankaReactVM(viewModel);
			const Screen = (): JSX.Element => <p data-testid="watched">{useVM().watched}</p>;

			render(<Screen />);
			act(() => {
				(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();
			});

			expect(screen.getByTestId("watched").textContent).toBe("1");
			expect(useVM.getState().watched).toBe(1);
		});
	}

	for (const shape of LANKA_STATELESS_VM_SHAPES) {
		it(`reads the actions of ${shape.name}`, () => {
			let called = 0;
			const useVM = toLankaReactVM(
				shape.build(() => {
					called += 1;
				}),
			);
			const Screen = (): JSX.Element => (
				<button type="button" onClick={() => useVM.getState().announce()}>
					go
				</button>
			);

			render(<Screen />);
			fireEvent.click(screen.getByText("go"));

			expect(called).toBe(1);
		});
	}
});

describe("the shallow selector, as a consumer writes it", () => {
	it("picks two keys into one object without looping", () => {
		// The commonest thing a React reader writes. Without a held selection
		// `useSyncExternalStore` sees a new object on every read and renders again
		// — "Maximum update depth exceeded", on the first paint.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = (): JSX.Element => {
			const { rows, isLoading } = useLankaVM(
				todosVM,
				useLankaShallow((state: ILankaFakeVMState) => ({
					rows: state.rows,
					isLoading: state.isLoading,
				})),
			);

			return <p data-testid="picked">{isLoading ? "loading" : String(rows.length)}</p>;
		};

		render(<Screen />);

		expect(screen.getByTestId("picked").textContent).toBe("0");
	});

	it("re-renders for a picked key and not for an unpicked one", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const onRender = vi.fn();
		const Screen = (): JSX.Element => {
			const { rows } = useLankaVM(
				todosVM,
				useLankaShallow((state: ILankaFakeVMState) => ({ rows: state.rows })),
			);
			onRender();

			return <p data-testid="count">{rows.length}</p>;
		};
		render(<Screen />);

		await act(async () => {
			await todosVM.getState().load();
		});
		const afterLoad = onRender.mock.calls.length;
		act(() => todosVM.getState().touchUnread());

		expect(screen.getByTestId("count").textContent).toBe("2");
		expect(onRender.mock.calls.length).toBe(afterLoad);
	});
});

describe("a form whose inputs live in the ViewModel", () => {
	it("re-renders the input that changed and not its neighbour", () => {
		const renameVM = createLankaFakeFormVM();
		const onCustomerRender = vi.fn();
		const onNoteRender = vi.fn();

		render(
			<PlaygroundRenameScreen
				renameVM={renameVM}
				onCustomerRender={onCustomerRender}
				onNoteRender={onNoteRender}
			/>,
		);
		const customerBefore = onCustomerRender.mock.calls.length;
		const noteBefore = onNoteRender.mock.calls.length;

		act(() => {
			renameVM.getState().setCustomer("Al");
		});

		// Flat keys: `customer` moved, `note` did not, and only the reader of
		// `customer` paid. One `values` object would have charged both.
		expect(onCustomerRender.mock.calls.length).toBe(customerBefore + 1);
		expect(onNoteRender.mock.calls.length).toBe(noteBefore);
	});

	it("shows the refusal at the input's own address", async () => {
		const renameVM = createLankaFakeFormVM();

		render(<PlaygroundRenameScreen renameVM={renameVM} />);
		act(() => {
			renameVM.getState().setCustomer("   ");
		});
		await act(async () => {
			await renameVM.getState().submit();
		});

		expect(screen.getByRole("alert").textContent).toBe("customer is required");
	});
});

const formScreens: [string, typeof PlaygroundHookFormScreen][] = [
	["React Hook Form", PlaygroundHookFormScreen],
	["TanStack Form", PlaygroundTanstackFormScreen],
	["Formik", PlaygroundFormikScreen],
];

/**
 * Three libraries, one ViewModel, one contract.
 *
 * The claim these prove is not "the form library works" — it is that a lanka
 * ViewModel's answer (`fields`, each with a path in SEGMENTS) reaches every
 * library's own idea of an address without the ViewModel, the gateway or the
 * schema knowing which library is on top.
 */
describe.each(formScreens)("the edit form on %s — the same ViewModel underneath", (_, Screen) => {
	const mount = async (server: IPlaygroundOrderServer = {}) => {
		const editVM = createPlaygroundOrderEditVM(server);
		await act(async () => {
			await editVM.getState().load(1);
		});

		const saved = editVM.getState().server;
		render(
			<Screen
				initial={{ customer: saved?.customer ?? "", items: saved?.items ?? [] }}
				submit={editVM.getState().submit}
			/>,
		);

		return editVM;
	};

	it("saves through the ViewModel and shows the saved version", async () => {
		const editVM = await mount();

		fireEvent.change(screen.getByLabelText("customer"), { target: { value: "Ann B" } });
		fireEvent.click(screen.getByText("save"));

		await screen.findByText("saved v2");
		expect(editVM.getState().server?.customer).toBe("Ann B");
	});

	it("places the server's refusal on the second line's quantity", async () => {
		const editVM = await mount({ refusals: { 1: "only 2 left" } });

		fireEvent.click(screen.getByText("save"));

		// The ViewModel handed over `["items", 1, "qty"]`; the screen spelled it
		// the way its library does and the message landed on the right line.
		await screen.findByText("only 2 left");
		expect(editVM.getState().server?.updatedAt).toBe(1);
	});

	it("keeps an empty input inside the form: the schema refuses before any request", async () => {
		const editVM = await mount();

		fireEvent.change(screen.getByLabelText("customer"), { target: { value: "" } });
		fireEvent.click(screen.getByText("save"));

		await screen.findByText("a customer is required");
		expect(editVM.getState().server?.updatedAt).toBe(1);
	});
});

describe("the host a screen is rendered under", () => {
	it("is the application's, not the binding's", async () => {
		// The binding takes no host and installs none: what a screen renders under
		// is whatever `startLanka` was given, which is the rule the hosts canon
		// states and the reason this package ships no provider.
		resetActiveLanka();
		await startLanka({ host: createLankaHost({ apiBaseUrl: "https://api.test" }) });

		expect(getLankaHost().apiBaseUrl).toBe("https://api.test");
	});
});

describe("reading with a selector", () => {
	it("re-renders when the SELECTOR's result changes, and not otherwise", () => {
		// With a selector the selector decides and tracking is bypassed: the
		// subscription notifies on every change, and React's own bail-out on an
		// equal snapshot is what stops the render. Both halves of that are here
		// because a binding that notified and then re-rendered regardless would
		// pass a test that only asserted the first.
		const renders: number[] = [];
		const todosVM = createLankaFakeVM({ rows: titles() });

		const Count = () => {
			const count = useLankaVM(todosVM, (state) => state.rows.length);
			renders.push(count);

			return <span>{count}</span>;
		};

		render(<Count />);
		const before = renders.length;

		act(() => {
			todosVM.getState().touchUnread();
		});

		expect(renders.length).toBe(before);
		expect(renders.at(-1)).toBe(0);
	});

	it("shows the selected value after a change that moved it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		const Count = () => {
			const count = useLankaVM(todosVM, (state) => state.rows.length);

			return <span>rows: {count}</span>;
		};

		render(<Count />);
		await act(async () => {
			await todosVM.getState().load();
		});

		expect(screen.getByText("rows: 2")).toBeTruthy();
	});
});
