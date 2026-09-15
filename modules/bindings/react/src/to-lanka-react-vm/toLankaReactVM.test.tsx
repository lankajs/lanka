import { createLankaVM } from "lanka/viewmodel";
import { act, render, cleanup, fireEvent } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toLankaReactVM } from "./toLankaReactVM";
import type { JSX } from "react";

/**
 * The React ergonomics, restored — and held to being ergonomics and nothing
 * more.
 *
 * Two things are under test and they pull in opposite directions: that the old
 * spelling works exactly as it did, and that nothing about the ViewModel changed
 * to make it work. The second is the one that matters, because the shelf's other
 * four bindings read the same objects.
 */
afterEach(cleanup);

interface ITodoState {
	todos: readonly string[];
	filter: string;
}

interface ITodoActions {
	add: (todo: string) => void;
	setFilter: (filter: string) => void;
	visible: () => readonly string[];
}

const build = () =>
	createLankaVM<ITodoState, ITodoActions>({
		name: "TodoVM",
		states: { todos: [], filter: "" },
		createActions: ({ set, get }) => ({
			add: (todo) => set({ todos: [...get().todos, todo] }),
			setFilter: (filter) => set({ filter }),
			visible: () => get().todos.filter((todo) => todo.includes(get().filter)),
		}),
	});

describe("calling it like a hook", () => {
	it("reads the whole state with no argument", () => {
		const useTodoVM = toLankaReactVM(build());
		const Screen = (): JSX.Element => <p>{useTodoVM().todos.join(",")}</p>;

		render(<Screen />);
		fireEvent.click(document.body);

		expect(screen.getByText("", { selector: "p" })).toBeDefined();
	});

	it("re-renders on a change, exactly as the hook spelling does", () => {
		const todoVM = build();
		const useTodoVM = toLankaReactVM(todoVM);
		const Screen = (): JSX.Element => <p data-testid="todos">{useTodoVM().todos.join(",")}</p>;

		render(<Screen />);
		act(() => todoVM.getState().add("write the façade"));

		expect(screen.getByTestId("todos").textContent).toBe("write the façade");
	});

	it("takes a selector, and answers what the selector picked", () => {
		const todoVM = build();
		const useTodoVM = toLankaReactVM(todoVM);
		const Screen = (): JSX.Element => (
			<p data-testid="count">{useTodoVM((state) => state.todos.length)}</p>
		);

		render(<Screen />);
		act(() => todoVM.getState().add("one"));

		expect(screen.getByTestId("count").textContent).toBe("1");
	});

	it("subscribes ONCE across many renders, selector or not", () => {
		// The failure this guards was measured on `useLankaVM` itself: keying the
		// subscription on an inline selector tore it down and rebuilt it every
		// render. A wrapper that passed the selector along differently would bring
		// that back, and nothing else here would notice.
		const todoVM = build();
		const subscribe = vi.spyOn(todoVM, "subscribe");
		const useTodoVM = toLankaReactVM(todoVM);

		const Screen = (): JSX.Element => (
			<p data-testid="count">{useTodoVM((state) => state.todos.length)}</p>
		);
		const { rerender } = render(<Screen />);
		rerender(<Screen />);
		rerender(<Screen />);

		expect(subscribe).toHaveBeenCalledTimes(1);
	});
});

describe("being a ViewModel at the same time", () => {
	it("answers getState outside a component", () => {
		const useTodoVM = toLankaReactVM(build());

		useTodoVM.getState().add("from a loader");

		expect(useTodoVM.getState().todos).toEqual(["from a loader"]);
	});

	it("answers subscribe, and the unsubscribe it returns works", () => {
		const useTodoVM = toLankaReactVM(build());
		const seen: number[] = [];

		const stop = useTodoVM.subscribe((next) => seen.push(next.todos.length));
		useTodoVM.getState().add("one");
		stop();
		useTodoVM.getState().add("two");

		expect(seen).toEqual([1]);
	});

	it("answers setState, getInitialState, name and isAccessTracked", () => {
		const useTodoVM = toLankaReactVM(build());

		useTodoVM.setState({ filter: "wr" });

		expect(useTodoVM.getState().filter).toBe("wr");
		expect(useTodoVM.getInitialState().todos).toEqual([]);
		expect(useTodoVM.name).toBe("TodoVM");
		expect(useTodoVM.isAccessTracked).toBe(true);
	});

	it("forwards EVERY member the ViewModel has", () => {
		/*
		 * The scene that keeps the forwarding honest.
		 *
		 * A hand-written list of members is a promise to notice when the port
		 * grows, and the lazy proxy in core exists because three such lists had
		 * already drifted. So the list is not written here: it is read off a real
		 * ViewModel, and the day the port gains a member this fails without anybody
		 * having remembered anything.
		 */
		const todoVM = build();
		const useTodoVM = toLankaReactVM(todoVM);

		const missing = Reflect.ownKeys(todoVM)
			.filter((key): key is string => typeof key === "string")
			.filter((key) => (useTodoVM as unknown as Record<string, unknown>)[key] === undefined);

		expect(missing).toEqual([]);
	});

	it("says it has the ViewModel's members when asked with `in`", () => {
		const useTodoVM = toLankaReactVM(build());

		expect("getState" in useTodoVM).toBe(true);
		expect("subscribe" in useTodoVM).toBe(true);
		expect("nothingByThisName" in useTodoVM).toBe(false);
	});

	it("is still a function where a function is expected", () => {
		const useTodoVM = toLankaReactVM(build());

		expect(typeof useTodoVM).toBe("function");
		// `name` is the ViewModel's, deliberately — it was the ViewModel's before
		// this function existed, because `build()` defines it over the store.
		expect(useTodoVM.name).toBe("TodoVM");
	});
});

describe("what it must not become", () => {
	it("is not iterable, not thenable and not a React element", async () => {
		// Every one of these is a property read that a lazy ViewModel answers with
		// a wrapper function. Forwarding symbols would make `await useTodoVM` hang,
		// `[...useTodoVM]` throw, and React look at the hook as an element.
		const useTodoVM = toLankaReactVM(build());

		expect((useTodoVM as unknown as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined();
		expect((useTodoVM as unknown as Record<string, unknown>).$$typeof).toBeUndefined();
		await expect(Promise.resolve(useTodoVM)).resolves.toBe(useTodoVM);
	});

	it("coerces to a string rather than reaching the ViewModel for one", () => {
		const useTodoVM = toLankaReactVM(build());

		// `toString` stays the FUNCTION's, which is why this reads as a function
		// and not as a store. Forwarded to the ViewModel it would have returned a
		// wrapper, and `String(useTodoVM)` would have thrown on a lazy one.
		expect(String(useTodoVM)).toContain("function");
	});

	it("wraps ONE store — the façade and the ViewModel are the same state", () => {
		const todoVM = build();
		const useTodoVM = toLankaReactVM(todoVM);

		todoVM.getState().add("written through the ViewModel");

		// The claim the whole design rests on: this is a spelling, not a second
		// store. A consumer holding both must not be holding two.
		expect(useTodoVM.getState().todos).toEqual(["written through the ViewModel"]);
		expect(useTodoVM.getState()).toBe(todoVM.getState());
	});

	it("leaves the portable spelling working on the very same object", () => {
		const todoVM = build();
		const useTodoVM = toLankaReactVM(todoVM);
		const Screen = (): JSX.Element => (
			<>
				<p data-testid="callable">{useTodoVM().todos.length}</p>
				<p data-testid="portable">{useTodoVM.getState().todos.length}</p>
			</>
		);

		render(<Screen />);
		act(() => todoVM.getState().add("one"));

		expect(screen.getByTestId("callable").textContent).toBe("1");
		expect(screen.getByTestId("portable").textContent).toBe("1");
	});
});
