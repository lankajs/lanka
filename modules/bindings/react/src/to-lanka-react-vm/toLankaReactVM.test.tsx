import {
	ALankaVM,
	createLankaSharedStore,
	createLankaVM,
	createLazyLankaVM,
	createLazySharedStoreLankaVM,
	createLazyStatelessLankaVM,
	createSharedStoreLankaVM,
	createStatelessLankaVM,
} from "lanka/viewmodel";
import type { ALankaSharedStore } from "lanka/viewmodel";
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

interface ISelection {
	selectedId: number | null;
}

interface IBadgeActions {
	select: (id: number) => void;
	clear: () => void;
}

interface ITrackerActions {
	track: (what: string) => void;
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

describe("over a LAZY ViewModel, which is what a real application declares", () => {
	/**
	 * The shape a consuming codebase actually has.
	 *
	 * `createLazyLankaVM` is what an application uses at module level, and the
	 * whole point of it is that declaring a ViewModel builds nothing: the store
	 * appears on first use, after bootstrap, and `dispose` sends it away again.
	 * A wrapper that ended that laziness would move every ViewModel's
	 * construction to import time, which is the one thing the lazy factory exists
	 * to prevent — and nothing else in this file would have noticed.
	 */
	const buildLazy = () =>
		createLazyLankaVM<ITodoState, ITodoActions>({
			name: "LazyTodoVM",
			states: { todos: [], filter: "" },
			createActions: ({ set, get }) => ({
				add: (todo) => set({ todos: [...get().todos, todo] }),
				setFilter: (filter) => set({ filter }),
				visible: () => get().todos.filter((todo) => todo.includes(get().filter)),
			}),
		});

	it("answers `name` without building the store", () => {
		const useTodoVM = toLankaReactVM(buildLazy());

		// The lazy proxy answers this from its config. Through the façade it must
		// still be the config's answer and not the function's own `name`.
		expect(useTodoVM.name).toBe("LazyTodoVM");
	});

	it("keeps `dispose`, which is not the store's and must not build one", () => {
		const useTodoVM = toLankaReactVM(buildLazy());

		expect(typeof useTodoVM.dispose).toBe("function");
		expect(() => useTodoVM.dispose()).not.toThrow();
	});

	it("builds on first use and reads back what an action wrote", () => {
		const useTodoVM = toLankaReactVM(buildLazy());

		useTodoVM.getState().add("declared lazily");

		expect(useTodoVM.getState().todos).toEqual(["declared lazily"]);
	});

	it("renders from a component, selector and all", () => {
		const useTodoVM = toLankaReactVM(buildLazy());
		const Screen = (): JSX.Element => (
			<p data-testid="count">{useTodoVM((state) => state.todos.length)}</p>
		);

		render(<Screen />);
		act(() => useTodoVM.getState().add("one"));

		expect(screen.getByTestId("count").textContent).toBe("1");
	});

	it("is still not thenable, which is the trap a lazy proxy sets", () => {
		// The lazy proxy answers an unknown property with a wrapper function, so a
		// façade forwarding symbols and `then` would make `await useTodoVM` hang
		// forever with no error and no stack. It cost a consumer an afternoon once.
		const useTodoVM = toLankaReactVM(buildLazy());

		expect((useTodoVM as unknown as Record<string, unknown>).then).toBeUndefined();
	});
});

describe("over EVERY shape a ViewModel comes in", () => {
	/**
	 * The claim a binding package exists to make.
	 *
	 * `@lankajs/react` is not "a hook that reads one kind of store" — it is what
	 * turns lanka into something a React codebase recognises, and a façade that
	 * covered two of the six factories would make that true for two of them. Core
	 * publishes six factories and three abstractions, and a consuming application
	 * has all of them in it at once.
	 *
	 * So every shape is driven here, through the same wrapper, with the member
	 * that makes each shape different asserted by name.
	 */
	const todoStore = () => createLankaSharedStore<ISelection>(() => ({ selectedId: null }));

	it("plain factory: reads, writes and re-renders", () => {
		const useTodoVM = toLankaReactVM(build());
		const Screen = (): JSX.Element => <p data-testid="c">{useTodoVM().todos.length}</p>;

		render(<Screen />);
		act(() => useTodoVM.getState().add("one"));

		expect(screen.getByTestId("c").textContent).toBe("1");
		expect(useTodoVM.setState).toBeTypeOf("function");
	});

	it("the CLASS style answers the same, because it is the same object", () => {
		class TodoVM extends ALankaVM<ITodoState, ITodoActions> {
			protected readonly name = "ClassTodoVM";

			protected override states(): ITodoState {
				return { todos: [], filter: "" };
			}

			protected createActions(): ITodoActions {
				return {
					add: (todo) => this.set({ todos: [...this.get().todos, todo] }),
					setFilter: (filter) => this.set({ filter }),
					visible: () =>
						this.get().todos.filter((todo) => todo.includes(this.get().filter)),
				};
			}
		}

		const useTodoVM = toLankaReactVM(new TodoVM().build());
		useTodoVM.getState().add("from a class");

		expect(useTodoVM.name).toBe("ClassTodoVM");
		expect(useTodoVM.getState().todos).toEqual(["from a class"]);
	});

	it("stateless: actions and no state, and the call still answers them", () => {
		const seen: string[] = [];
		const useTrackerVM = toLankaReactVM(
			createStatelessLankaVM<ITrackerActions>({
				name: "TrackerVM",
				createActions: () => ({ track: (what: string) => seen.push(what) }),
			}),
		);
		const Screen = (): JSX.Element => {
			// Read during RENDER and call in the handler. Calling `useTrackerVM()`
			// inside `onClick` is a hook call outside a render and React refuses it
			// by name — which is worth knowing, because it is the mistake a 1.x
			// codebase makes when it moves a `useTodoVM()` line into a callback.
			const { track } = useTrackerVM();

			return (
				<button type="button" onClick={() => track("clicked")}>
					go
				</button>
			);
		};

		render(<Screen />);
		fireEvent.click(screen.getByText("go"));

		// A stateless ViewModel never notifies — `subscribe` returns an unsubscribe
		// and calls nobody — so this asserts the one thing that matters: reading it
		// from a component works and needs no state to exist.
		expect(seen).toEqual(["clicked"]);
		expect(useTrackerVM.name).toBe("TrackerVM");
	});

	it("stateless: and from a handler the way a real screen does it", () => {
		// `useFAQViewModel.getState().track(…)` is what a consuming application
		// writes in an `onClick`, and it is not a hook call at all — which is the
		// half of the old ergonomics that had nothing to do with hooks and went on
		// working throughout.
		const seen: string[] = [];
		const useTrackerVM = toLankaReactVM(
			createStatelessLankaVM<ITrackerActions>({
				name: "HandlerTrackerVM",
				createActions: () => ({ track: (what: string) => seen.push(what) }),
			}),
		);
		const Screen = (): JSX.Element => (
			<button type="button" onClick={() => useTrackerVM.getState().track("from a handler")}>
				go
			</button>
		);

		render(<Screen />);
		fireEvent.click(screen.getByText("go"));

		expect(seen).toEqual(["from a handler"]);
	});

	it("lazy stateless: same, and still built on first use", () => {
		const useTrackerVM = toLankaReactVM(
			createLazyStatelessLankaVM<ITrackerActions>({
				name: "LazyTrackerVM",
				createActions: () => ({ track: () => undefined }),
			}),
		);

		expect(useTrackerVM.name).toBe("LazyTrackerVM");
		expect(typeof useTrackerVM.dispose).toBe("function");
		expect(useTrackerVM.getState().track).toBeTypeOf("function");
	});

	it("shared store: `getStoreState` survives the wrapper", () => {
		const store = todoStore();
		const useBadgeVM = toLankaReactVM(
			createSharedStoreLankaVM<ISelection, IBadgeActions, ALankaSharedStore<ISelection>>({
				name: "BadgeVM",
				store,
				createActions: ({ set }) => ({
					select: (id: number) => set({ selectedId: id }),
					clear: () => set({ selectedId: null }),
				}),
			}),
		);

		useBadgeVM.getState().select(7);

		// The one member this shape adds, and the reason the forwarding is a Proxy
		// over everything rather than a list of the port's members: a list written
		// for `ILankaReadableVM` would have dropped exactly this.
		expect(useBadgeVM.getStoreState()).toEqual({ selectedId: 7 });
		expect(useBadgeVM.getState().selectedId).toBe(7);
	});

	it("shared store: two ViewModels over one store, read through two façades", () => {
		const store = todoStore();
		const makeVM = (name: string) =>
			toLankaReactVM(
				createSharedStoreLankaVM<ISelection, IBadgeActions, ALankaSharedStore<ISelection>>({
					name,
					store,
					createActions: ({ set }) => ({
						select: (id: number) => set({ selectedId: id }),
						clear: () => set({ selectedId: null }),
					}),
				}),
			);
		const useBadgeVM = makeVM("BadgeVM");
		const useListVM = makeVM("ListVM");

		useBadgeVM.getState().select(3);

		// One store, two ViewModels, two wrappers — and still one answer. A façade
		// that had copied state instead of forwarding would show two.
		expect(useListVM.getStoreState().selectedId).toBe(3);
	});

	it("lazy shared store: `getStoreState` and `dispose`, neither built by a read", () => {
		const store = todoStore();
		const useBadgeVM = toLankaReactVM(
			createLazySharedStoreLankaVM<ISelection, IBadgeActions, ALankaSharedStore<ISelection>>({
				name: "LazyBadgeVM",
				store,
				createActions: ({ set }) => ({
					select: (id: number) => set({ selectedId: id }),
					clear: () => set({ selectedId: null }),
				}),
			}),
		);

		expect(useBadgeVM.name).toBe("LazyBadgeVM");
		expect(typeof useBadgeVM.dispose).toBe("function");
		useBadgeVM.getState().select(9);
		expect(useBadgeVM.getStoreState().selectedId).toBe(9);
	});

	it("every shape keeps the scenario members its state carries", () => {
		// `initializeScenario` and `resetScenario` are on the STATE of all three
		// shapes, not on the port, so they travel through `getState` — and a façade
		// that had narrowed the state would have lost the framework's own lifecycle.
		const useTodoVM = toLankaReactVM(build());

		expect(useTodoVM.getState().initializeScenario).toBeTypeOf("function");
		expect(useTodoVM.getState().resetScenario).toBeTypeOf("function");
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
