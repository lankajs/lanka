import { describe, expect, it } from "vitest";
import { createLankaVM } from "../create-lanka-vm/createLankaVM";
import { createLazyLankaVM } from "../create-lazy-lanka-vm/createLazyLankaVM";
import { createLankaCallableVM } from "./createLankaCallableVM";

/**
 * The forwarding every binding is built on, asserted without a framework.
 *
 * What is under test is the part that is easy to get subtly wrong and was once
 * written out in `@lankajs/react` alone: which members belong to the FUNCTION,
 * which to the ViewModel, what `in` answers, and what a lazy ViewModel does when
 * something reads a symbol off it.
 */
interface ITodoState {
	todos: readonly string[];
}

interface ITodoActions {
	add: (todo: string) => void;
}

type TCall = () => ITodoState & ITodoActions;

const config = (built?: string[]) => ({
	name: "TodoVM",
	states: { todos: [] as readonly string[] },
	createActions: ({
		set,
		get,
	}: {
		set: (partial: Partial<ITodoState>) => void;
		get: () => ITodoState;
	}) => {
		built?.push("createActions");

		return { add: (todo: string) => set({ todos: [...get().todos, todo] }) };
	},
});

describe("createLankaCallableVM", () => {
	it("calls what it was given, and reads the ViewModel by name", () => {
		const viewModel = createLankaVM<ITodoState, ITodoActions>(config());
		const callable = createLankaCallableVM<typeof viewModel, TCall>(viewModel, () =>
			viewModel.getState(),
		);

		expect(callable().todos).toEqual([]);

		callable.getState().add("write");

		expect(callable().todos).toEqual(["write"]);
		expect(callable.getState().todos).toEqual(["write"]);
	});

	it("`name` is the ViewModel's, not the function's", () => {
		const viewModel = createLankaVM<ITodoState, ITodoActions>(config());
		const callable = createLankaCallableVM<typeof viewModel, TCall>(viewModel, () =>
			viewModel.getState(),
		);

		// The trap that makes this worth a test: a function has its own `name`, and
		// the one a caller means is the ViewModel's.
		expect(callable.name).toBe("TodoVM");
	});

	it("keeps the members that must come from the function", () => {
		const viewModel = createLankaVM<ITodoState, ITodoActions>(config());
		const callable = createLankaCallableVM<typeof viewModel, TCall>(viewModel, () =>
			viewModel.getState(),
		);

		expect(typeof callable.call).toBe("function");
		expect(typeof callable.apply).toBe("function");
		expect(typeof callable.bind).toBe("function");
		expect(() => String(callable)).not.toThrow();
	});

	it("`in` answers for the ViewModel as well as the function", () => {
		const viewModel = createLankaVM<ITodoState, ITodoActions>(config());
		const callable = createLankaCallableVM<typeof viewModel, TCall>(viewModel, () =>
			viewModel.getState(),
		);

		// Reading `getState` hands one back, so reporting that it is absent would
		// make a devtool, a serialiser and every duck-typed helper disagree with
		// the object in front of them.
		expect("getState" in callable).toBe(true);
		expect("subscribe" in callable).toBe(true);
		expect("call" in callable).toBe(true);
		expect("nothingIsCalledThis" in callable).toBe(false);
	});

	it("is not thenable, which is the trap a lazy ViewModel sets", async () => {
		const viewModel = createLazyLankaVM<ITodoState, ITodoActions>(config());
		const callable = createLankaCallableVM<typeof viewModel, TCall>(viewModel, () =>
			viewModel.getState(),
		);

		// A lazy ViewModel answers an unknown property with a wrapper function, so
		// an awaited callable would be handed a `then` that never resolves. Symbols
		// and function members are excluded wholesale for the same reason.
		expect(await Promise.resolve(callable)).toBe(callable);
		expect(callable[Symbol.toPrimitive as unknown as keyof typeof callable]).toBeUndefined();
	});

	it("forwards rather than copies, so a lazy ViewModel stays lazy", () => {
		const built: string[] = [];
		const viewModel = createLazyLankaVM<ITodoState, ITodoActions>(config(built));
		const callable = createLankaCallableVM<typeof viewModel, TCall>(viewModel, () =>
			viewModel.getState(),
		);

		expect(built).toEqual([]);
		expect(callable.name).toBe("TodoVM");
		expect(built).toEqual([]);

		callable.getState().add("write");

		expect(built).toEqual(["createActions"]);
	});
});
