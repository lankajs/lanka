/**
 * The declaration site, in one line.
 *
 * What is under test is not the reading — `useLankaVM` and `toLankaCallableVM`
 * own that and are tested where they live. It is the promise these six names
 * make: core's factory, core's config, core's ViewModel, already wearing
 * Svelte's read, so a consumer moves a declaration by changing the import line.
 */
import { describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { createLankaVM } from "./createLankaVM";
import { toLankaSvelteVM } from "../../to-lanka-svelte-vm/toLankaSvelteVM";
import { runInLankaEffect } from "../../../_playground/run-in-lanka-effect/runInLankaEffect.svelte";

interface ITodoState {
	todos: readonly string[];
	filter: string;
}

interface ITodoActions {
	add: (todo: string) => void;
}

const config = () => ({
	name: "TodoVM",
	states: { todos: [] as readonly string[], filter: "" },
	createActions: ({
		set,
		get,
	}: {
		set: (partial: Partial<ITodoState>) => void;
		get: () => ITodoState;
	}) => ({
		add: (todo: string) => set({ todos: [...get().todos, todo] }),
	}),
});

describe("createLankaVM (Svelte)", () => {
	it("answers a ViewModel that is already readable by calling it", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const view = todoVM();
		const seen: number[] = [];

		const probe = runInLankaEffect(() => {
			seen.push(view.todos.length);
		});

		expect(seen).toEqual([0]);

		todoVM.getState().add("write");
		flushSync();

		expect(seen).toEqual([0, 1]);

		view.stop();
		probe.destroy();
	});

	it("takes a selector, and answers it under `current` as this binding does", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const count = todoVM((state) => state.todos.length);

		expect(count.current).toBe(0);

		todoVM.getState().add("write");

		expect(count.current).toBe(1);
		count.stop();
	});

	it("is the ViewModel too: its members answer outside a read", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());

		expect(todoVM.name).toBe("TodoVM");
		expect(todoVM.getState().todos).toEqual([]);
		expect(typeof todoVM.subscribe).toBe("function");
		expect("getState" in todoVM).toBe(true);
	});

	it("is one store, and the same store core's own factory builds", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const seen: number[] = [];

		todoVM.subscribe((next) => seen.push(next.todos.length));
		todoVM.getState().add("write");

		expect(seen).toEqual([1]);
		expect(todoVM.getState().todos).toEqual(["write"]);

		// The framework-free declaration, for comparison: same config, same answer.
		const coreVM = createCoreLankaVM<ITodoState, ITodoActions>(config());

		coreVM.getState().add("write");
		expect(coreVM.getState().todos).toEqual(todoVM.getState().todos);
	});

	it("is still a Svelte store, because `subscribe` is forwarded onto the callable", () => {
		// The other half of this package is untouched by the six names: a
		// declaration made here is handed to `toLankaSvelteVM` and `$todoVM` reads
		// it, because what the callable forwards IS the ViewModel's `subscribe`.
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const store = toLankaSvelteVM(todoVM);
		const seen: string[][] = [];

		const unsubscribe = store.subscribe((state) => {
			seen.push([...state.todos]);
		});

		// The contract's own rule: the current value, synchronously.
		expect(seen).toEqual([[]]);

		todoVM.getState().add("write");

		expect(seen).toEqual([[], ["write"]]);
		unsubscribe();
	});
});
