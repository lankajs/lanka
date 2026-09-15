import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import { defineComponent, h, nextTick } from "vue";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { defineLankaStore } from "./defineLankaStore";
import { lankaStoreToRefs } from "../lanka-store-to-refs/lankaStoreToRefs";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";

/**
 * The Vue spelling, and the two rules that keep it a spelling.
 *
 * It must read like Vue — `store.rows`, no `.value`, in the template and in the
 * script alike — and it must be the same subscription `useLankaVM` opens, over
 * the same store, with the same notifications. The second half is what the
 * parity canon asks of every idiom, and it is asserted here rather than assumed.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	cleanup();
	resetActiveLanka();
});

const titles = (): readonly string[] => ["write the canon", "run the canon"];

describe("declaring it the way Pinia declares a store", () => {
	it("opens NOTHING until the store is called", () => {
		// The reason it answers a function. Declared at module level, a store that
		// built itself would subscribe at IMPORT time — outside any component
		// scope, so nothing would ever release it.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");

		const useTodosStore = defineLankaStore(todosVM);

		expect(subscribe).not.toHaveBeenCalled();
		useTodosStore().$stop();
	});

	it("gives each caller its own recording, which is the point", async () => {
		// Measured before this shape existed: with one shared store the component
		// reading only `rows` re-rendered when `unread` moved. Access tracking
		// belongs to whoever did the reading, and two components are two readers.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const useTodosStore = defineLankaStore(todosVM);
		let rowsRenders = 0;
		let unreadRenders = 0;

		const RowsScreen = defineComponent({
			setup() {
				const store = useTodosStore();

				return () => {
					rowsRenders += 1;

					return h("p", String(store.rows.length));
				};
			},
		});
		const UnreadScreen = defineComponent({
			setup() {
				const store = useTodosStore();

				return () => {
					unreadRenders += 1;

					return h("p", String(store.unread));
				};
			},
		});
		render(RowsScreen);
		render(UnreadScreen);
		await nextTick();
		const rowsBefore = rowsRenders;
		const unreadBefore = unreadRenders;

		todosVM.getState().touchUnread();
		await nextTick();

		expect(rowsRenders).toBe(rowsBefore);
		expect(unreadRenders).toBeGreaterThan(unreadBefore);
	});

	it("opens one subscription PER CALLER", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");
		const useTodosStore = defineLankaStore(todosVM);

		const first = useTodosStore();
		const second = useTodosStore();

		expect(subscribe).toHaveBeenCalledTimes(2);
		first.$stop();
		second.$stop();
	});

	it("reads ONE ViewModel through all of them", async () => {
		// Two objects, one state. Where Pinia answers one object, this answers one
		// STORE — and an idiom may not change what the state is.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const useTodosStore = defineLankaStore(todosVM);
		const first = useTodosStore();
		const second = useTodosStore();

		await first.load();

		expect(second.rows).toEqual(titles());
		expect(first.rows).toEqual(second.rows);
		first.$stop();
		second.$stop();
	});

	it("releases a caller's subscription with its component", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const useTodosStore = defineLankaStore(todosVM);
		let renders = 0;
		const Screen = defineComponent({
			setup() {
				const store = useTodosStore();

				return () => {
					renders += 1;

					return h("p", String(store.rows.length));
				};
			},
		});
		const view = render(Screen);
		await nextTick();
		const before = renders;

		view.unmount();
		await todosVM.getState().load();
		await nextTick();

		// Vue owns the scope, so nothing here calls `$stop` — which is the whole
		// reason the subscription is opened inside the call rather than beside it.
		expect(renders).toBe(before);
	});
});

describe("reading it the way Vue reads a store", () => {
	it("reads a member straight off the store, with no `.value`", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		const store = defineLankaStore(todosVM)();

		expect(store.rows).toEqual([]);
		expect(store.isLoading).toBe(false);
		store.$stop();
	});

	it("renders in a template and repaints when an action writes", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = defineComponent({
			setup() {
				const store = defineLankaStore(todosVM)();

				return () =>
					h(
						"ul",
						store.rows.map((row: string) => h("li", { key: row }, row)),
					);
			},
		});

		render(Screen);
		await todosVM.getState().load();
		await nextTick();

		expect(screen.getByText("write the canon")).toBeTruthy();
	});

	it("calls an action off the store, as a Pinia consumer types it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();

		await store.load();

		expect(store.rows).toEqual(titles());
		store.$stop();
	});

	it("spreads and enumerates, which a bare Proxy refuses", () => {
		// `{ ...store }` and `Object.keys(store)` both throw on a Proxy whose
		// descriptors are invented but not declared configurable. A Vue devtool, a
		// snapshot and a test all do one or the other.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();

		expect(Object.keys(store)).toContain("rows");
		expect({ ...store }).toHaveProperty("isLoading");
		expect("rows" in store).toBe(true);
		expect("nothingByThisName" in store).toBe(false);
		store.$stop();
	});

	it("describes `$stop` as a real, non-enumerable member", () => {
		// A devtool, a serialiser and `Object.assign` all ask for a descriptor
		// before they touch a key. `$stop` has to answer with one that is honest —
		// present, not enumerable, not writable — or an inspector shows a member
		// that `Object.keys` denies exists.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();

		const described = Object.getOwnPropertyDescriptor(store, "$stop");

		expect(described?.enumerable).toBe(false);
		expect(described?.configurable).toBe(true);
		expect(typeof described?.value).toBe("function");
		store.$stop();
	});

	it("keeps `$stop` out of the state's namespace", () => {
		// Pinia's `$`-prefix, for Pinia's reason: the keys belong to the
		// application, and a meta member sharing that namespace collides the day
		// somebody adds a `stop` of their own.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();

		expect(typeof store.$stop).toBe("function");
		expect(Object.keys(store)).not.toContain("$stop");
		store.$stop();
	});
});

describe("being the same subscription, not a second one", () => {
	it("opens ONE subscription on the ViewModel", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");

		const store = defineLankaStore(todosVM)();

		expect(subscribe).toHaveBeenCalledTimes(1);
		store.$stop();
	});

	it("answers the same state `useLankaVM` answers", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();
		const ref = useLankaVM(todosVM);

		await todosVM.getState().load();

		// One ViewModel, two readers, two spellings — and the same answer. A façade
		// that had copied state would show two.
		expect(store.rows).toEqual(ref.value.rows);
		store.$stop();
		ref.stop();
	});

	it("stops when told to, and the ViewModel goes on living", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();

		store.$stop();
		await todosVM.getState().load();

		expect(todosVM.getState().rows).toEqual(titles());
	});
});

describe("lankaStoreToRefs", () => {
	it("gives names that keep tracking", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();
		const { rows } = lankaStoreToRefs(store);

		await todosVM.getState().load();

		expect(rows.value).toEqual(titles());
		store.$stop();
	});

	it("renders through a destructured name", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = defineComponent({
			setup() {
				const { rows } = lankaStoreToRefs(defineLankaStore(todosVM)());

				return () =>
					h(
						"ul",
						rows.value.map((row: string) => h("li", { key: row }, row)),
					);
			},
		});

		render(Screen);
		await todosVM.getState().load();
		await nextTick();

		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("leaves actions alone, so a call site does not write `load.value()`", () => {
		// An action is a stable function for the life of the store, so
		// `const { load } = store` was already correct — wrapping it would have
		// made the idiom worse than the thing it replaced.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();

		const refs = lankaStoreToRefs(store);

		expect(refs).not.toHaveProperty("load");
		expect(typeof store.load).toBe("function");
		store.$stop();
	});

	it("shows the mistake it exists to prevent", () => {
		// The Pinia footgun, asserted rather than described: a plain destructure
		// reads the value ONCE, so the name still holds the first paint after the
		// state has moved. It looks like working code, which is why it needs a
		// named answer beside it.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = defineLankaStore(todosVM)();
		const { rows } = store;

		todosVM.setState({ rows: titles() });

		expect(rows).toEqual([]);
		expect(store.rows).toEqual(titles());
		store.$stop();
	});
});
