import { beforeEach, describe, expect, it } from "vitest";
import { TestBed } from "@angular/core/testing";
import {
	Component,
	EnvironmentInjector,
	VERSION,
	createEnvironmentInjector,
	effect,
	provideZonelessChangeDetection,
	runInInjectionContext,
} from "@angular/core";
import { lankaViewBindingConformance } from "@lankajs/tool-testing/lankaViewBindingConformance";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import {
	createLankaVM,
	createLazyLankaVM,
	createLazySharedStoreLankaVM,
	createLazyStatelessLankaVM,
	createSharedStoreLankaVM,
	createStatelessLankaVM,
	useLankaVM,
} from "@lankajs/angular";
import { renderWithLanka } from "@lankajs/angular/testing";
import type {
	ILankaConformanceState,
	ILankaMountedBinding,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * A reader in its own child injector — the subscription and the effect that
 * reads it both live there, so destroying it releases exactly this reader, the
 * way a component's destruction does.
 *
 * The binding's own playground adapter, restated here rather than imported: the
 * SCENES are the shelf's — `lankaViewBindingConformance` — and what a caller
 * writes is only how Angular makes an injection context, reads a signal in an
 * effect and destroys the context.
 */
const reader = <TRead>(
	subscribe: () => () => TRead,
	onRead: (value: TRead) => void,
): ILankaMountedBinding => {
	let renders = 0;
	const scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

	runInInjectionContext(scope, () => {
		const read = subscribe();

		effect(() => {
			renders += 1;
			onRead(read());
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
};

/**
 * Every scene the Angular binding is held to, run against whichever Angular the
 * calling application installed — and first, which Angular that is.
 *
 * The version check is what keeps this from lying. The binding is workspace
 * source with its own Angular beside it; the calling application's
 * `resolve.dedupe` is what makes it resolve the application's instead. If that
 * stopped working, every scene below would pass against the wrong major.
 */
export const angularBindingScenes = (expectedMajor: string): void => {
	beforeEach(() => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
	});

	describe(`Angular ${expectedMajor}: which Angular this is`, () => {
		it("runs the binding against the installed major, not the binding's own", () => {
			expect(VERSION.major).toBe(expectedMajor);
		});
	});

	describe(`Angular ${expectedMajor}: the testing entry`, () => {
		it("renders a component that reads a ViewModel, with a fresh framework instance", async () => {
			const todosVM = createLankaFakeVM({ rows: ["write the canon"] });
			const Screen = Component({ selector: "lanka-screen", standalone: true, template: "" })(
				class {
					protected readonly state = useLankaVM(todosVM);
				},
			);

			const view = await renderWithLanka(Screen);

			expect(view.lanka).toBeDefined();
		});
	});

	lankaViewBindingConformance({
		vendor: `Angular ${expectedMajor}`,
		declare: {
			createLankaVM: (config) => createLankaVM(config),
			createLazyLankaVM: (config) => createLazyLankaVM(config),
			createStatelessLankaVM: (config) => createStatelessLankaVM(config),
			createLazyStatelessLankaVM: (config) => createLazyStatelessLankaVM(config),
			createSharedStoreLankaVM: (config) => createSharedStoreLankaVM(config),
			createLazySharedStoreLankaVM: (config) => createLazySharedStoreLankaVM(config),
		},
		mountSelected: <TSelected>(
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			selector: (state: ILankaConformanceState) => TSelected,
			read: (selected: TSelected) => void,
		): ILankaMountedBinding => reader(() => useLankaVM(viewModel, selector), read),
		mount: (
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			read: (state: ILankaConformanceState) => void,
		): ILankaMountedBinding => reader(() => useLankaVM(viewModel), read),
	});
};
