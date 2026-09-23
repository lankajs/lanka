// JIT: this module's component is compiled in the page, not by a build step,
// which is what lets one source go through Vite and webpack alike — neither
// needs an Angular plugin. The compiler must load before the first component.
import "@angular/compiler";
import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import {
	Component,
	InjectionToken,
	Injector,
	createComponent,
	inject,
	provideZonelessChangeDetection,
} from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { defineLankaVM, resolveLankaVM } from "lanka/extend";
import { hydrateLankaVM } from "@lankajs/host";
import { useLankaVM } from "@lankajs/angular";
import type { TMissionsMount } from "../../Core/Mount/TMissionsMount";

/** This module's own ViewModel, as a definition — the same reasoning as the React module's. */
const missions = defineLankaVM({
	name: "MissionsAngularVM",
	build: () => createAtlasMissionsVM(new AtlasMissionGateway()),
});

type TMissionsVM = ReturnType<typeof createAtlasMissionsVM>;

/**
 * The ViewModel this mount resolved, handed to the component by injection.
 *
 * Not closed over: a component class per mount would give two mounts on one
 * page two classes with one selector, which Angular refuses as an ID collision.
 */
const MISSIONS_VM = new InjectionToken<TMissionsVM>("MissionsAngularVM");

/**
 * The Angular screen, declared by CALLING the decorator rather than writing one.
 *
 * `Component({...})(class)` is what `@Component` compiles to, and written out it
 * needs no decorator support from the bundler — esbuild, Rollup and webpack all
 * see an ordinary call. `useLankaVM` runs in the component's injection context,
 * as Angular's binding requires.
 */
const MissionsAngular = Component({
	selector: "lanka-missions-angular",
	standalone: true,
	template: `
			<ul aria-label="Missions in Angular">
				@for (mission of state().rows().items; track mission.id) {
					<li>{{ mission.code }} {{ mission.title }}</li>
				}
			</ul>
		`,
})(
	class {
		protected readonly state = useLankaVM(inject(MISSIONS_VM));
	},
);

/**
 * What the shell calls — the same contract as every other module.
 *
 * Zoneless, so the page need not load `zone.js` for one module: a signal the
 * binding exposes is what schedules the repaint.
 */
export const mountMissionsAngular: TMissionsMount = async (element, { missions: rows, scope }) => {
	const viewModel = resolveLankaVM(missions, { scope });
	hydrateLankaVM(viewModel, { missions: rows });

	const application = await createApplication({ providers: [provideZonelessChangeDetection()] });
	const component = createComponent(MissionsAngular, {
		environmentInjector: application.injector,
		elementInjector: Injector.create({
			providers: [{ provide: MISSIONS_VM, useValue: viewModel }],
		}),
		hostElement: element,
	});
	application.attachView(component.hostView);
	component.changeDetectorRef.detectChanges();

	return () => application.destroy();
};
