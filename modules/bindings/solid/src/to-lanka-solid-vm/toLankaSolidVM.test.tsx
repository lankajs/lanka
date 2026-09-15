import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { toLankaSolidVM } from "./toLankaSolidVM";

/**
 * The Solid spelling, held to being a spelling.
 *
 * It must read like Solid — `store.rows`, no call — and it must be the same
 * subscription over the same store, with the same skips. The second half is what
 * the parity canon asks of every idiom.
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

describe("reading it the way Solid reads a store", () => {
	it("reads a member straight off the store, with no call", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSolidVM(todosVM);

		expect(store.rows).toEqual([]);
		expect(store.isLoading).toBe(false);
		store.$stop();
	});

	it("reads what an action wrote, with no re-read in between", async () => {
		// The shape that decides everything: a store read from ordinary code must
		// be LIVE. A signal holding the state would have handed back a snapshot
		// taken before the action ran.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSolidVM(todosVM);

		await store.load();

		expect(store.rows).toEqual(titles());
		store.$stop();
	});

	it("renders, and repaints when an action writes", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const Screen = () => {
			const store = toLankaSolidVM(todosVM);

			return (
				<ul>
					{store.rows.map((row: string) => (
						<li>{row}</li>
					))}
				</ul>
			);
		};

		render(() => <Screen />);
		await todosVM.getState().load();

		expect(screen.getByText("write the canon")).toBeTruthy();
	});

	it("does NOT repaint for a key the view never read", async () => {
		// `unread` exists to be moved and not seen. The read IS the subscription,
		// in Solid's graph and in the access tracker at once — so a view that never
		// read it is not woken by it.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const renders = vi.fn();
		const Screen = () => {
			const store = toLankaSolidVM(todosVM);

			return (
				<ul>
					{(() => {
						renders();

						return store.rows.map((row: string) => <li>{row}</li>);
					})()}
				</ul>
			);
		};
		render(() => <Screen />);
		const before = renders.mock.calls.length;

		todosVM.getState().touchUnread();

		expect(renders.mock.calls.length).toBe(before);
	});

	it("spreads and enumerates, which a bare Proxy refuses", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSolidVM(todosVM);

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
		const store = toLankaSolidVM(todosVM);

		const described = Object.getOwnPropertyDescriptor(store, "$stop");

		expect(described?.enumerable).toBe(false);
		expect(described?.configurable).toBe(true);
		expect(typeof described?.value).toBe("function");
		store.$stop();
	});

	it("keeps `$stop` out of the state's namespace", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSolidVM(todosVM);

		expect(typeof store.$stop).toBe("function");
		expect(Object.keys(store)).not.toContain("$stop");
		store.$stop();
	});
});

describe("being the same store, not a second one", () => {
	it("opens ONE subscription on the ViewModel", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");

		const store = toLankaSolidVM(todosVM);

		expect(subscribe).toHaveBeenCalledTimes(1);
		store.$stop();
	});

	it("reads the ViewModel's own state, not a copy", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSolidVM(todosVM);

		await todosVM.getState().load();

		expect(store.rows).toBe(todosVM.getState().rows);
		store.$stop();
	});

	it("stops when told to, and the ViewModel goes on living", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const store = toLankaSolidVM(todosVM);

		store.$stop();
		await todosVM.getState().load();

		expect(todosVM.getState().rows).toEqual(titles());
	});
});
