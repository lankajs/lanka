import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationRef, Component, effect, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
	LANKA_STATELESS_VM_SHAPES,
	LANKA_VM_SHAPES,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import {
	createLazyLankaVM,
	createLazyStatelessLankaVM,
	createStatelessLankaVM,
} from "lanka/viewmodel";
import { createLankaFakeFormVM, createLankaFakeVM } from "@lankajs/tool-testing";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { AsyncPipe } from "@angular/common";
import { toLankaObservable, toLankaSignals, useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import {
	playgroundVMBuildLog,
	usePlaygroundDeclaredTodosVM,
	usePlaygroundLazyTodosVM,
} from "./app";
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

/**
 * Which declarations had already built a store by the time the suite started.
 *
 * Read here, at the test file's own module level, because that is the only
 * moment the question can be asked: `./app` is imported on the lines above, both
 * declarations run there, and the first `beforeEach` is already too late.
 */
const builtAtImport = [...playgroundVMBuildLog];

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
	/*
	 * A selector carrying the field, and it is not decoration. Angular derives a
	 * component's id from its class name, its selector and its template, and this
	 * factory hands back a class called `FieldInput` with an empty template every
	 * time — so two of them collided on one id and Angular said so as NG0912 on
	 * every run. Two components sharing an id share hydration and style scoping,
	 * which is a real defect in an application and was a real warning here.
	 */
	@Component({ selector: `lanka-field-${field}`, template: "", standalone: true })
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

/**
 * The two things Angular says out loud, and which nothing used to read.
 *
 * Both were TRUE for months and both went past every run, because a suite that
 * prints a warning on every file is a suite whose warnings nobody reads — which
 * is also how the next real one gets through. Neither claim is about a binding
 * API, so neither belongs in the conformance shelf; they are about this
 * package's own harness, so they live here.
 */
describe("what Angular reports while the suite runs", () => {
	it("runs with no Zone at all, which is what zoneless MEANS", () => {
		// Zone.js is what `fakeAsync` and `waitForAsync` need, and this playground
		// uses neither. It was loaded anyway — the setup imported
		// `@analogjs/vite-plugin-angular/setup-vitest`, four zone imports and a
		// patch over Vitest's `describe` — and Angular answered NG0914 on every
		// file: zoneless change detection while zone.js is still loading.
		//
		// The global and not a manifest scan, because the defect was the HARNESS
		// loading it rather than the package declaring it.
		expect((globalThis as { Zone?: unknown }).Zone).toBeUndefined();
	});

	it("builds two components from one factory without giving them one id", async () => {
		// NG0912. Angular derives a component's id from its class name, its
		// selector and its template, so a factory handing back a class called
		// `FieldInput` with an empty template twice produced two components with
		// ONE id — which in an application means shared hydration and shared style
		// scoping, silently.
		//
		// Asserted through the console, because that is the only place Angular says
		// it. A scene reading component ids would be asserting against a private
		// field; a scene reading the warning asserts the thing that was wrong.
		//
		// BOTH channels are watched. Angular reports this one through `console.warn`
		// and its neighbours through `console.error`, and a spy on one of them is a
		// guard that passes while the warning it was written for goes to the other.
		const said: string[] = [];
		const record = (...args: unknown[]): void => {
			said.push(args.map(String).join(" "));
		};
		const warn = vi.spyOn(console, "warn").mockImplementation(record);
		const error = vi.spyOn(console, "error").mockImplementation(record);

		try {
			// The classes are BUILT here, which is where the id is derived and where
			// the collision is reported — long before anything renders one.
			const formVM = createLankaFakeFormVM();
			TestBed.createComponent(inputReading(formVM, "customer", () => undefined));
			TestBed.createComponent(inputReading(formVM, "note", () => undefined));
			await TestBed.inject(ApplicationRef).whenStable();
		} finally {
			warn.mockRestore();
			error.mockRestore();
		}

		expect(said.filter((one) => one.includes("NG0912"))).toEqual([]);
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

/**
 * The screen a consumer writes over a one-line declaration.
 *
 * It takes no inputs and injects nothing but the ViewModel, because that is the
 * shape the pre-applied read buys: the declaration is a module, the component
 * calls it in a FIELD INITIALISER — which is an injection context, where
 * `ngOnInit` is not — and there is no provider and no `useLankaVM(todosVM)` in
 * between. `state()` because the call answers a `Signal`, which is Angular's own
 * idea of a value and the one thing this shelf deliberately does not hide.
 */
@Component({
	selector: "lanka-declared-todos",
	standalone: true,
	template: "<h1>{{ state().heading }}</h1><p>{{ state().titles.join(', ') }}</p>",
})
class DeclaredTodoScreen {
	protected readonly state = usePlaygroundDeclaredTodosVM();
}

/** The same screen over a LAZY declaration, and it reads no differently. */
@Component({
	selector: "lanka-lazy-todos",
	standalone: true,
	template: "<h1>{{ state().heading }}</h1><p>{{ state().titles.join(', ') }}</p>",
})
class LazyTodoScreen {
	protected readonly state = usePlaygroundLazyTodosVM();
}

describe("a ViewModel declared through the binding's own factory", () => {
	/**
	 * The declaration a consumer writes now, and the one thing the scenes above
	 * cannot show.
	 *
	 * Every one of them builds a ViewModel inside a test and closes over it. What
	 * `createLankaVM` from THIS package is for is the other shape: one line at
	 * module level, imported by a component that takes no inputs at all — and
	 * IMPORTING it is where this binding had the most to lose. There is no
	 * injection context at import time, so a factory that pre-applied
	 * `toLankaSignals` would throw on the import line. It pre-applies
	 * `useLankaVM`, which asserts per CALL, and the module below imports clean.
	 */
	beforeEach(() => {
		usePlaygroundDeclaredTodosVM.setState(usePlaygroundDeclaredTodosVM.getInitialState());
	});

	it("renders what the declaration holds, and then what an action wrote", () => {
		const screen = TestBed.createComponent(DeclaredTodoScreen);
		screen.detectChanges();

		expect(screen.nativeElement.textContent).toContain("the canon");
		expect(screen.nativeElement.textContent).not.toContain("write the canon");

		usePlaygroundDeclaredTodosVM.getState().load();
		screen.detectChanges();

		expect(screen.nativeElement.textContent).toContain("write the canon");
		expect(screen.nativeElement.textContent).toContain("run the canon");
	});

	it("is still the ViewModel, so a resolver reads it with no injector", () => {
		usePlaygroundDeclaredTodosVM.getState().load();

		expect(usePlaygroundDeclaredTodosVM.getState().titles).toHaveLength(2);
		expect(usePlaygroundDeclaredTodosVM.name).toBe("PlaygroundDeclaredTodosVM");
	});
});

describe("a LAZY ViewModel declared through the binding's own factory", () => {
	it("built nothing at the declaration, nor to answer its own name", () => {
		// The claim `createLazyLankaVM` is wrapped for, asserted where it happens.
		// Its eager neighbour built its store at import — so the log proves it can
		// see a build at all — and this one did not, although the same module was
		// imported at the same moment.
		expect(builtAtImport).toContain("PlaygroundDeclaredTodosVM");
		expect(builtAtImport).not.toContain("PlaygroundLazyTodosVM");

		expect(usePlaygroundLazyTodosVM.name).toBe("PlaygroundLazyTodosVM");
		expect(playgroundVMBuildLog).not.toContain("PlaygroundLazyTodosVM");
	});

	it("still reads from a component, and the store arrives then", () => {
		const screen = TestBed.createComponent(LazyTodoScreen);
		screen.detectChanges();

		expect(playgroundVMBuildLog).toContain("PlaygroundLazyTodosVM");
		expect(screen.nativeElement.textContent).toContain("the canon, lazily");

		usePlaygroundLazyTodosVM.getState().load();
		screen.detectChanges();

		expect(screen.nativeElement.textContent).toContain("write the canon");
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

describe("the stream spelling, as a consumer writes it", () => {
	it("renders through Angular's own `async` pipe", async () => {
		// The half of Angular that speaks RxJS: the `async` pipe, `HttpClient`, the
		// router's events, every `switchMap` a codebase already has. A signal
		// cannot be passed to `combineLatest`; this can.
		const todosVM = createLankaFakeVM({ rows: titles() });

		@Component({
			template: "{{ (todos$ | async)?.rows?.length }}",
			standalone: true,
			imports: [AsyncPipe],
		})
		class TodoScreen {
			protected readonly todos$ = toLankaObservable(todosVM);
		}

		const screen = TestBed.createComponent(TodoScreen);
		screen.detectChanges();
		await todosVM.getState().load();
		screen.detectChanges();

		expect(screen.nativeElement.textContent).toContain("2");
	});

	it("works outside an injection context, where the signal spellings refuse", () => {
		// A stream's subscriber holds its own unsubscribe, so this is usable from a
		// service, a resolver, an interceptor and a plain function.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];

		const subscription = toLankaObservable(todosVM).subscribe((state) =>
			seen.push(state.rows.length),
		);

		expect(seen).toEqual([0]);
		subscription.unsubscribe();
	});
});

describe("over a LAZY ViewModel, which is what a real application declares", () => {
	const buildLazy = () =>
		createLazyLankaVM<{ watched: number }, { bump: () => void }>({
			name: "LazyAngularVM",
			states: { watched: 0 },
			createActions: ({ set, get }) => ({ bump: () => set({ watched: get().watched + 1 }) }),
		});

	it("answers its name without building the store", () => {
		const viewModel = buildLazy();

		expect(viewModel.name).toBe("LazyAngularVM");
		expect(typeof viewModel.dispose).toBe("function");
	});

	it("reads and updates through a signal per field", () => {
		const viewModel = buildLazy();

		@Component({ template: "", standalone: true })
		class LazyScreen {
			public readonly fields = toLankaSignals(viewModel);
		}

		const screen = TestBed.createComponent(LazyScreen);
		viewModel.getState().bump();
		TestBed.flushEffects();

		expect(screen.componentInstance.fields.watched()).toBe(1);
	});
});

describe("over a STATELESS ViewModel, which has no state to read", () => {
	it("reads its actions and is never woken", () => {
		let called = 0;
		const viewModel = createStatelessLankaVM<{ announce: () => void }>({
			name: "StatelessAngularVM",
			createActions: () => ({
				announce: () => {
					called += 1;
				},
			}),
		});

		@Component({ template: "", standalone: true })
		class StatelessScreen {
			public readonly fields = toLankaSignals(viewModel);
		}

		const screen = TestBed.createComponent(StatelessScreen);
		screen.componentInstance.fields.announce();

		expect(called).toBe(1);
	});

	it("reads a LAZY stateless ViewModel the same way", () => {
		let called = 0;
		const viewModel = createLazyStatelessLankaVM<{ announce: () => void }>({
			name: "LazyStatelessAngularVM",
			createActions: () => ({
				announce: () => {
					called += 1;
				},
			}),
		});

		@Component({ template: "", standalone: true })
		class LazyStatelessScreen {
			public readonly fields = toLankaSignals(viewModel);
		}

		const screen = TestBed.createComponent(LazyStatelessScreen);
		screen.componentInstance.fields.announce();

		expect(called).toBe(1);
	});
});
