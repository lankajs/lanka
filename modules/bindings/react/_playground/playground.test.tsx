import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { createLankaHost, getLankaHost } from "lanka/config";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	createPlaygroundOrderEditVM,
	createPlaygroundRenameVM,
	createPlaygroundTodosVM,
	PlaygroundFormikScreen,
	PlaygroundHookFormScreen,
	PlaygroundRenameScreen,
	PlaygroundTanstackFormScreen,
	PlaygroundTodoScreen,
} from "./app";
import type { IPlaygroundOrderServer } from "./app";
import type { IPlaygroundTodo } from "./app";

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
const todos = (): IPlaygroundTodo[] => [
	{ id: 1, title: "write the canon", done: false },
	{ id: 2, title: "run the canon", done: false },
];

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
		const todosVM = createPlaygroundTodosVM(todos);

		render(<PlaygroundTodoScreen todosVM={todosVM} />);
		await act(async () => {
			await todosVM.getState().load();
		});

		expect(screen.getByText("write the canon")).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		const todosVM = createPlaygroundTodosVM(todos);

		render(<PlaygroundTodoScreen todosVM={todosVM} />);
		await act(async () => {
			await todosVM.getState().load();
		});

		act(() => {
			todosVM.getState().complete(2);
		});

		expect(screen.getByText("run the canon ✓")).toBeTruthy();
	});

	it("shows the failure the ViewModel named", async () => {
		const todosVM = createPlaygroundTodosVM(todos);

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
		const todosVM = createPlaygroundTodosVM(todos);

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
		const todosVM = createPlaygroundTodosVM(todos);

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
		const todosVM = createPlaygroundTodosVM(todos, false);

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
		const todosVM = createPlaygroundTodosVM(todos);
		const subscribe = vi.spyOn(todosVM, "subscribe");

		const { rerender } = render(<PlaygroundTodoScreen todosVM={todosVM} />);
		for (let index = 0; index < 20; index += 1) {
			rerender(<PlaygroundTodoScreen todosVM={todosVM} />);
		}

		expect(subscribe).toHaveBeenCalledTimes(1);
	});
});

describe("a form whose inputs live in the ViewModel", () => {
	it("re-renders the input that changed and not its neighbour", () => {
		const renameVM = createPlaygroundRenameVM();
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

	it("shows the schema's refusal at the input's own address", async () => {
		const renameVM = createPlaygroundRenameVM();

		render(<PlaygroundRenameScreen renameVM={renameVM} />);
		act(() => {
			renameVM.getState().setCustomer("   ");
		});
		await act(async () => {
			await renameVM.getState().submit();
		});

		expect(screen.getByRole("alert").textContent).toBe("a customer is required");
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
