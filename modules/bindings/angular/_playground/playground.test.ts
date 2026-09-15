import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Component, effect, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
	LANKA_STATELESS_VM_SHAPES,
	LANKA_VM_SHAPES,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import { createLankaFakeFormVM, createLankaFakeVM } from "@lankajs/tool-testing";
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
type TFormVM = ReturnType<typeof createLankaFakeFormVM>;

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

/**
 * One input, one ViewModel key, and one READER.
 *
 * A component per input rather than one holding both, deliberately: a tracker
 * belongs to whoever did the reading, so a single component reading both keys is
 * one reader of both and is woken by either — which is correct, and is not the
 * claim. What the scene asserts is that two SEPARATE readers of one ViewModel are
 * woken separately.
 */
const inputReading = (formVM: TFormVM, field: "customer" | "note", onRead: () => void) => {
	@Component({ template: "", standalone: true })
	class FieldInput {
		private readonly state = useLankaVM(formVM);

		public constructor() {
			effect(() => {
				onRead();
				void this.state()[field];
			});
		}
	}

	return FieldInput;
};

describe("a screen that shows what went wrong", () => {
	it("shows the failure the ViewModel named", () => {
		// The component owns no error state and catches nothing: the ViewModel
		// decided what a failure means, and this reads the word it wrote.
		const todosVM = createLankaFakeVM({ rows: titles() });

		@Component({ template: "", standalone: true })
		class AlertScreen {
			public readonly state = useLankaVM(todosVM);
		}

		const screen = TestBed.createComponent(AlertScreen);
		todosVM.getState().fail("the relay is down");

		expect(screen.componentInstance.state().error).toBe("the relay is down");
	});
});

describe("a ViewModel that turned tracking off", () => {
	it("updates for everything once the ViewModel turns tracking off", () => {
		// The documented remedy for the blind spot: a ViewModel that DERIVES what
		// the screen shows sets the flag false, and then every change counts —
		// including the one nothing read.
		let renders = 0;
		const todosVM = createLankaFakeVM({ rows: titles(), tracked: false });
		TestBed.createComponent(screenReading(todosVM, () => (renders += 1)));
		TestBed.flushEffects();
		const before = renders;

		todosVM.getState().touchUnread();
		TestBed.flushEffects();

		expect(renders).toBeGreaterThan(before);
	});
});

describe("the subscription itself", () => {
	it("subscribes ONCE however many times the component updates", async () => {
		// A subscription rebuilt per update is the failure measured in React at 201
		// subscriptions for 200 renders. Angular has no render loop of that shape,
		// and the claim is still worth making in its own vocabulary.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const subscribe = vi.spyOn(todosVM, "subscribe");
		TestBed.createComponent(screenReading(todosVM));
		TestBed.flushEffects();

		await todosVM.getState().load();
		TestBed.flushEffects();
		todosVM.getState().touchUnread();
		TestBed.flushEffects();

		expect(subscribe).toHaveBeenCalledTimes(1);
	});
});

describe("a form whose inputs live in the ViewModel", () => {
	it("updates the input that changed and not its neighbour", () => {
		// Access tracking compares ROOT keys, which is the whole reason the form's
		// fields are two of them: a single `values` object would charge both inputs
		// for every keystroke.
		const formVM = createLankaFakeFormVM();
		let customerReads = 0;
		let noteReads = 0;
		TestBed.createComponent(inputReading(formVM, "customer", () => (customerReads += 1)));
		TestBed.createComponent(inputReading(formVM, "note", () => (noteReads += 1)));
		TestBed.flushEffects();
		const noteBefore = noteReads;
		const customerBefore = customerReads;

		formVM.getState().setCustomer("Bo");
		TestBed.flushEffects();

		expect(customerReads).toBeGreaterThan(customerBefore);
		expect(noteReads).toBe(noteBefore);
	});

	it("shows the refusal at the input's own address", async () => {
		const formVM = createLankaFakeFormVM();

		@Component({ template: "", standalone: true })
		class FormErrors {
			public readonly state = useLankaVM(formVM);
		}

		const screen = TestBed.createComponent(FormErrors);
		formVM.getState().setCustomer("");
		await formVM.getState().submit();

		expect(screen.componentInstance.state().fieldErrors).toEqual([
			{ path: ["customer"], message: "customer is required" },
		]);
	});
});

describe("reading through a selector", () => {
	it("updates when the SELECTOR's result changes", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		let seen = 0;

		@Component({ template: "", standalone: true })
		class CountScreen {
			public readonly count = useLankaVM(todosVM, (state) => state.rows.length);

			public constructor() {
				effect(() => {
					seen += 1;
					void this.count();
				});
			}
		}

		const screen = TestBed.createComponent(CountScreen);
		TestBed.flushEffects();
		const before = seen;

		await todosVM.getState().load();
		TestBed.flushEffects();

		expect(seen).toBeGreaterThan(before);
		expect(screen.componentInstance.count()).toBe(2);
	});

	it("shows the selected value after a change that moved it", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });

		@Component({ template: "", standalone: true })
		class CountScreen {
			public readonly count = useLankaVM(todosVM, (state) => state.rows.length);
		}

		const screen = TestBed.createComponent(CountScreen);
		await todosVM.getState().load();
		TestBed.flushEffects();

		expect(screen.componentInstance.count()).toBe(2);
	});
});

describe("a signal per field, over every shape a ViewModel comes in", () => {
	/*
	 * The conformance suite drives `useLankaVM`, which is not what this package's
	 * OWN idiom is. A signal per field has to answer the same six shapes, and the
	 * list is the suite's so the two cannot drift.
	 */
	for (const shape of LANKA_VM_SHAPES) {
		it(`reads and updates over ${shape.name}`, () => {
			const viewModel = shape.build();

			@Component({ template: "", standalone: true })
			class ShapeScreen {
				public readonly fields = toLankaSignals(viewModel);
			}

			const screen = TestBed.createComponent(ShapeScreen);
			(viewModel.getState() as unknown as { bumpWatched: () => void }).bumpWatched();
			TestBed.flushEffects();

			expect(screen.componentInstance.fields.watched()).toBe(1);
		});
	}

	for (const shape of LANKA_STATELESS_VM_SHAPES) {
		it(`reads the actions of ${shape.name}`, () => {
			let called = 0;
			const viewModel = shape.build(() => {
				called += 1;
			});

			@Component({ template: "", standalone: true })
			class ShapeScreen {
				public readonly fields = toLankaSignals(viewModel);
			}

			const screen = TestBed.createComponent(ShapeScreen);
			screen.componentInstance.fields.announce();

			expect(called).toBe(1);
		});
	}
});
