import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { derived, get } from "svelte/store";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { toLankaSvelteStore } from "./toLankaSvelteStore";

/**
 * The Svelte spelling, held to being a spelling.
 *
 * Two halves: it must satisfy the store contract well enough for `svelte/store`'s
 * own helpers to accept it — which is the only definition of "works with `$`"
 * that is not a guess — and it must be the same subscription, over the same
 * store, with the same skips.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(resetActiveLanka);

const titles = (): readonly string[] => ["write the canon", "run the canon"];

describe("the store contract, as `svelte/store` defines it", () => {
	it("calls `run` immediately, synchronously, before subscribe returns", () => {
		// `$store` reads during the component's first render. A store that waited
		// for the first change would render `undefined` and then flicker — and the
		// ViewModel's own `subscribe` deliberately does NOT fire on registration,
		// which is why this call is made by hand.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: unknown[] = [];

		const stop = toLankaSvelteStore(todosVM).subscribe((value) => seen.push(value.rows));

		expect(seen).toHaveLength(1);
		stop();
	});

	it("is readable by `get`, which is how every Svelte helper reads one", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		expect(get(toLankaSvelteStore(todosVM)).isLoading).toBe(false);
	});

	it("feeds `derived`, which is the contract's real test", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSvelteStore(todosVM);

		const count = derived(store, (state) => state.rows.length);

		expect(get(count)).toBe(0);
	});

	it("hands back an unsubscribe that actually stops it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];
		const stop = toLankaSvelteStore(todosVM).subscribe((value) => seen.push(value.rows.length));

		stop();
		await todosVM.getState().load();

		expect(seen).toEqual([0]);
	});
});

describe("what a subscriber hears", () => {
	it("hears an action's write", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: readonly string[][] = [];
		const heard: string[][] = seen as string[][];
		const stop = toLankaSvelteStore(todosVM).subscribe((value) => heard.push([...value.rows]));

		await todosVM.getState().load();

		expect(heard.at(-1)).toEqual(titles());
		stop();
	});

	it("does NOT hear a key it never read", async () => {
		// Access tracking, through the Svelte spelling: `unread` exists to be moved
		// and not seen. A store that forwarded every notification would repaint the
		// component for a key nothing on screen reads.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const heard: number[] = [];
		const stop = toLankaSvelteStore(todosVM).subscribe((value) => {
			void value.rows;
			heard.push(value.rows.length);
		});
		const before = heard.length;

		todosVM.getState().touchUnread();

		expect(heard).toHaveLength(before);
		stop();
	});

	it("gives each subscriber its own recording", async () => {
		// Two readers of one ViewModel read different keys and must be woken for
		// different changes — the same rule every binding on the shelf follows, and
		// the reason the tracker is built per subscriber rather than per store.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const rowsReader: number[] = [];
		const unreadReader: number[] = [];

		const stopRows = toLankaSvelteStore(todosVM).subscribe((value) => {
			void value.rows;
			rowsReader.push(1);
		});
		const stopUnread = toLankaSvelteStore(todosVM).subscribe((value) => {
			void value.unread;
			unreadReader.push(1);
		});

		todosVM.getState().touchUnread();

		expect(rowsReader).toHaveLength(1);
		expect(unreadReader).toHaveLength(2);
		stopRows();
		stopUnread();
	});
});

describe("being the same store, not a second one", () => {
	it("opens ONE ViewModel subscription per Svelte subscriber", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");
		const store = toLankaSvelteStore(todosVM);

		const first = store.subscribe(() => undefined);
		const second = store.subscribe(() => undefined);

		expect(subscribe).toHaveBeenCalledTimes(2);
		first();
		second();
	});

	it("reads the ViewModel's own state, not a copy of it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSvelteStore(todosVM);

		await todosVM.getState().load();

		expect(get(store).rows).toEqual(todosVM.getState().rows);
	});

	it("leaves the ViewModel alive when the last subscriber goes", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		toLankaSvelteStore(todosVM).subscribe(() => undefined)();

		await todosVM.getState().load();

		expect(todosVM.getState().rows).toEqual(titles());
	});
});
