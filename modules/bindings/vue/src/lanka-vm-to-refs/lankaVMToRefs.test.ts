import { describe, expect, it, vi } from "vitest";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { defineLankaComposable } from "../define-lanka-composable/defineLankaComposable";
import { lankaVMToRefs } from "./lankaVMToRefs";

/**
 * What is unproven about `lankaVMToRefs` on its own.
 *
 * `defineLankaComposable.test.ts` already shows the two units working TOGETHER —
 * a template rendering through a destructured name, and the Pinia footgun the
 * function exists to avoid. What is missing is `lankaVMToRefs` held to its own
 * three promises: a stable `ComputedRef` per key, every action left out (not
 * just one named example), and — the one nothing else asks — that building the
 * refs opens no subscription of its own.
 *
 * The input has to be a real `TLankaVueVM`: `computed(() => viewModel[key])`
 * only re-derives when Vue's reactivity is actually touched inside the getter,
 * and that happens through `defineLankaComposable`'s internal version ref, not
 * through a hand-shaped stand-in. A fake shaped like the type but built by hand
 * would look right and never update, which is the exact mistake this file
 * exists to catch.
 */
const titles = (): readonly string[] => ["write the canon", "run the canon"];

describe("lankaVMToRefs", () => {
	it("gives each key a ComputedRef whose reference is stable while its value tracks the store", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaComposable(todosVM)();
		const refs = lankaVMToRefs(store);
		const rowsRef = refs.rows;

		expect(rowsRef.value).toEqual([]);

		await todosVM.getState().load();

		// The SAME ComputedRef object, now answering the new value — the promise
		// that destructuring `lankaVMToRefs(store)` does not freeze a name the way
		// destructuring the store itself does.
		expect(refs.rows).toBe(rowsRef);
		expect(rowsRef.value).toEqual(titles());
		store.$stop();
	});

	it("omits every action, not only the one example anybody thought to check", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaComposable(todosVM)();

		const refs = lankaVMToRefs(store);
		const keys = Object.keys(refs);

		expect(keys).not.toContain("load");
		expect(keys).not.toContain("fail");
		expect(keys).not.toContain("touchUnread");
		expect(keys.sort()).toEqual(["error", "isLoading", "rows", "unread"]);
		store.$stop();
	});

	it("opens no subscription of its own — the composable's is still the only one", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");
		const store = defineLankaComposable(todosVM)();

		expect(subscribe).toHaveBeenCalledTimes(1);

		lankaVMToRefs(store);

		// Building N refs must add ZERO subscriptions: every `computed` reads
		// through the composable's own proxy rather than reaching back to the VM.
		expect(subscribe).toHaveBeenCalledTimes(1);
		store.$stop();
	});
});
