import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Component, effect, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { useLankaVM } from "../src/index";
import type { ILankaFakeVMActions, ILankaFakeVMState } from "@lankajs/tool-testing";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The package, exercised as a consumer uses it.
 *
 * The same claims every other binding's playground makes, in the same words —
 * reading two of them side by side should show only each framework's own syntax.
 */
type TTodosVM = ILankaReadableVM<ILankaFakeVMState & ILankaFakeVMActions>;

const titles = (): readonly string[] => ["write the canon", "run the canon"];

/** A ViewModel read in a FIELD INITIALISER, which is an injection context. */
const screenReading = (todosVM: TTodosVM, onRender?: () => void) => {
	@Component({ template: "", standalone: true })
	class TodoScreen {
		protected readonly state = useLankaVM(todosVM);

		public constructor() {
			effect(() => {
				onRender?.();
				void this.state().rows;
			});
		}

		public rows(): readonly string[] {
			return this.state().rows;
		}
	}

	return TodoScreen;
};

beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

afterEach(() => {
	resetActiveLanka();
});

describe("a component reading a ViewModel", () => {
	it("reads what the ViewModel holds", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const screen = TestBed.createComponent(screenReading(todosVM));

		await todosVM.getState().load();
		TestBed.flushEffects();

		expect([...screen.componentInstance.rows()]).toEqual([...titles()]);
	});
});

describe("when a change is worth an update, and when it is not", () => {
	it("updates for a key the component READ", async () => {
		let renders = 0;
		const todosVM = createLankaFakeVM({ rows: titles() });
		TestBed.createComponent(screenReading(todosVM, () => (renders += 1)));
		TestBed.flushEffects();
		const before = renders;

		await todosVM.getState().load();
		TestBed.flushEffects();

		expect(renders).toBeGreaterThan(before);
	});

	it("does NOT update for a key nothing read", () => {
		// The whole of access tracking in one scene: `unread` moves, no component
		// ever looked at it, and nothing updates.
		let renders = 0;
		const todosVM = createLankaFakeVM({ rows: titles() });
		TestBed.createComponent(screenReading(todosVM, () => (renders += 1)));
		TestBed.flushEffects();
		const before = renders;

		todosVM.getState().touchUnread();
		TestBed.flushEffects();

		expect(renders).toBe(before);
	});
});

describe("reading a ViewModel outside an injection context", () => {
	it("refuses, rather than leaking a subscription with no owner", () => {
		// The one place this binding is STRICTER than `@lankajs/vue` and
		// `@lankajs/solid`, which publish a `stop()` for exactly this case.
		// `DestroyRef` is the only way Angular can learn the caller has gone, so a
		// subscription made without one is a leak nobody owns — and a refusal read
		// once beats a leak found in production.
		const todosVM = createLankaFakeVM({ rows: titles() });

		expect(() => useLankaVM(todosVM)).toThrow();
	});
});
