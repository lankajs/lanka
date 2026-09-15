import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { toLankaSolidStore, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import { createLankaFakeVM } from "@lankajs/tool-testing";

/**
 * The package, exercised as a consumer uses it.
 *
 * The same claims `@lankajs/react`'s and `@lankajs/vue`'s playgrounds make, in
 * the same words — reading them side by side should show only each framework's
 * own syntax.
 */
const titles = (): readonly string[] => ["write the canon", "run the canon"];

type TTodosVM = ReturnType<typeof createLankaFakeVM>;

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
