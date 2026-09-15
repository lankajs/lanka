import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Component, effect, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { toLankaSignals } from "./toLankaSignals";
import type { ILankaFakeVMActions, ILankaFakeVMState } from "@lankajs/tool-testing";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The Angular spelling, held to being a spelling.
 *
 * It must read like an Angular service — a signal per field, actions as
 * functions — and it must be the same subscription over the same store, with the
 * same skips. The second half is what the parity canon asks of every idiom.
 */
type TTodosVM = ILankaReadableVM<ILankaFakeVMState & ILankaFakeVMActions>;

const titles = (): readonly string[] => ["write the canon", "run the canon"];

beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

afterEach(resetActiveLanka);

/** A ViewModel read in a FIELD INITIALISER, which is an injection context. */
const screenReading = (todosVM: TTodosVM, onEffect?: (rows: readonly string[]) => void) => {
	@Component({ template: "", standalone: true })
	class TodoScreen {
		public readonly todos = toLankaSignals(todosVM);

		public constructor() {
			effect(() => onEffect?.(this.todos.rows()));
		}
	}

	return TodoScreen;
};

describe("reading it the way an Angular service exposes state", () => {
	it("gives a signal per value", () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const screen = TestBed.createComponent(screenReading(todosVM));

		expect(screen.componentInstance.todos.rows()).toEqual([]);
		expect(screen.componentInstance.todos.isLoading()).toBe(false);
		expect(screen.componentInstance.todos.error()).toBeNull();
	});

	it("updates a field's signal when an action writes", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const screen = TestBed.createComponent(screenReading(todosVM));

		await todosVM.getState().load();

		expect([...screen.componentInstance.todos.rows()]).toEqual([...titles()]);
	});

	it("leaves an action a plain function, not a signal", () => {
		// A signal here would make every call site write `load()()`. An action is
		// one object for the life of the store, so there is nothing for a signal to
		// report.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const screen = TestBed.createComponent(screenReading(todosVM));

		expect(typeof screen.componentInstance.todos.load).toBe("function");
		expect(typeof screen.componentInstance.todos.fail).toBe("function");
	});

	it("drives an effect, which is how a template reads it", async () => {
		const seen: readonly string[][] = [];
		const heard = seen as string[][];
		const todosVM = createLankaFakeVM({ rows: titles() });
		TestBed.createComponent(screenReading(todosVM, (rows) => heard.push([...rows])));
		TestBed.flushEffects();

		await todosVM.getState().load();
		TestBed.flushEffects();

		expect(heard.at(-1)).toEqual([...titles()]);
	});

	it("does NOT wake a reader for a field it never read", async () => {
		// `unread` exists to be moved and not seen. Two layers agree here: the
		// access tracker skips the notification, and a `computed` whose value is
		// unchanged notifies nobody.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const onEffect = vi.fn();
		TestBed.createComponent(screenReading(todosVM, onEffect));
		TestBed.flushEffects();
		const before = onEffect.mock.calls.length;

		todosVM.getState().touchUnread();
		TestBed.flushEffects();

		expect(onEffect.mock.calls.length).toBe(before);
	});
});

describe("being the same store, not a second one", () => {
	it("opens ONE subscription for the whole set of fields", () => {
		// One per field would be five subscriptions for a five-key state, and five
		// trackers disagreeing about what this reader looked at.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");

		TestBed.createComponent(screenReading(todosVM));

		expect(subscribe).toHaveBeenCalledTimes(1);
	});

	it("reads the ViewModel's own state, not a copy", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const screen = TestBed.createComponent(screenReading(todosVM));

		await todosVM.getState().load();

		expect(screen.componentInstance.todos.rows()).toBe(todosVM.getState().rows);
	});

	it("refuses to be called outside an injection context", () => {
		// `DestroyRef` is the only way to learn the caller has gone, and a
		// subscription that cannot learn that is a leak with no owner. The same
		// rule `useLankaVM` states, for the same reason.
		const todosVM = createLankaFakeVM({ rows: titles() });

		expect(() => toLankaSignals(todosVM)).toThrow();
	});

	it("stops when the component is destroyed", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const screen = TestBed.createComponent(screenReading(todosVM));

		screen.destroy();
		await todosVM.getState().load();

		// The ViewModel goes on living; only this reader has gone.
		expect(todosVM.getState().rows).toEqual(titles());
	});
});
