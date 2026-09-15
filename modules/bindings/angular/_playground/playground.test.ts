import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Component, effect, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { toLankaSignals, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
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

describe("rendering with a bootstrapped framework", () => {
	it("renders a component that needs a live instance, with no bootstrap in sight", async () => {
		// What `@lankajs/angular/testing` is for, proved the way a consumer uses it.
		// `await`ed where the other four bindings are not: Angular Testing Library
		// drives `TestBed`, which COMPILES a component rather than mounting one.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const view = await renderWithLanka(screenReading(todosVM));

		expect(view.lanka).toBeDefined();
	});

	it("hands every call a FRESH instance", async () => {
		// The TestBed is reset between the two renders because Angular refuses to
		// reconfigure a module it has already instantiated — its constraint, not
		// lanka's. What is being asserted is still lanka's: a render never inherits
		// the previous one's instance, and a test that did would pass or fail by
		// file order.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const first = await renderWithLanka(screenReading(todosVM));

		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		const second = await renderWithLanka(screenReading(todosVM));

		expect(second.lanka).not.toBe(first.lanka);
	});
});

describe("a signal per field, as a consumer writes it", () => {
	it("reads a field's signal and calls an action off the same object", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		@Component({ template: "", standalone: true })
		class TodoScreen {
			public readonly todos = toLankaSignals(todosVM);
		}

		const screen = TestBed.createComponent(TodoScreen);
		await screen.componentInstance.todos.load();

		expect([...screen.componentInstance.todos.rows()]).toEqual([...titles()]);
		expect(screen.componentInstance.todos.isLoading()).toBe(false);
	});
});
