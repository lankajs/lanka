import { beforeEach, describe } from "vitest";
import { TestBed } from "@angular/core/testing";
import { createEnvironmentInjector, effect, provideZonelessChangeDetection } from "@angular/core";
import { EnvironmentInjector, runInInjectionContext } from "@angular/core";
import { lankaViewBindingConformance } from "@lankajs/tool-testing/lankaViewBindingConformance";
import { useLankaVM } from "../src/index";
import type {
	ILankaConformanceState,
	ILankaMountedBinding,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The list this binding is held to, written independently of it.
 *
 * The same eleven scenes every other member runs, in the same words. What is
 * written here is only how Angular makes an injection context, reads a signal in
 * an effect and destroys the context — and that this file reworded no scene is
 * the evidence the port is a ViewModel's shape rather than any one framework's.
 *
 * ## Why `TestBed`, and why a CHILD injector inside it
 *
 * Angular's effects are SCHEDULED, and the scheduler lives in an environment
 * injector — a bare `Injector.create` has none, and effects there never run.
 * `TestBed` provides one, and `flushEffects` is that scheduler run to
 * completion: what React calls `act`, Vue `nextTick` and Svelte `flushSync`.
 *
 * The reader lives in a CHILD of it so that unmounting destroys exactly this
 * reader, which is what a component's destruction does. Resetting the whole
 * TestBed would also work and would prove less: a scene about one reader going
 * away must not take the framework with it.
 *
 * Zoneless, because a signal is what zoneless change detection reads and that is
 * the shape this binding is for.
 */
describe("the Angular binding", () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
	});

	lankaViewBindingConformance({
		vendor: "Angular",

		mountSelected: <TSelected>(
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			selector: (state: ILankaConformanceState) => TSelected,
			read: (selected: TSelected) => void,
		): ILankaMountedBinding => {
			let renders = 0;
			const scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

			runInInjectionContext(scope, () => {
				const picked = useLankaVM(viewModel, selector);

				effect(() => {
					renders += 1;
					read(picked());
				});
			});

			TestBed.flushEffects();

			return {
				renders: () => renders,
				unmount: () => {
					scope.destroy();
				},
				act: (change) => {
					change();
					TestBed.flushEffects();
				},
			};
		},

		mount: (
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			read: (state: ILankaConformanceState) => void,
		): ILankaMountedBinding => {
			let renders = 0;
			const scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

			runInInjectionContext(scope, () => {
				const state = useLankaVM(viewModel);

				effect(() => {
					renders += 1;
					read(state());
				});
			});

			TestBed.flushEffects();

			return {
				renders: () => renders,
				unmount: () => {
					scope.destroy();
				},
				act: (change) => {
					change();
					TestBed.flushEffects();
				},
			};
		},
	});
});
