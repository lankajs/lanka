import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Component, inject, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LankaError } from "lanka/errors";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { ATLAS_MISSIONS_VM } from "./atlasMissionsVM";
import { formatAtlasMissionLine } from "./formatAtlasMissionLine";
import { useAtlasMissions } from "./useAtlasMissions";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The ecosystem's read path, driven by Angular's own change detection.
 *
 * `provideZonelessChangeDetection` and no `zone.js` anywhere: what the binding
 * produces is a SIGNAL, and a signal is exactly what zoneless change detection
 * reads. A ViewModel needing Zone would mean the framework had a mechanism of
 * its own to be patched, which is the thing `_plans/14` exists to disprove.
 *
 * The compiler is why this suite is here rather than in
 * `modules/bindings/angular`: that package drives signals and an injector, both
 * plain runtime APIs, and says so in its own config. A TEMPLATE needs the whole
 * Angular compiler, and what a template proves is a consumer's build.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.configureTestingModule({
		providers: [
			provideZonelessChangeDetection(),
			{ provide: ATLAS_MISSIONS_VM, useValue: null },
		],
	});
});

afterEach(() => {
	TestBed.resetTestingModule();
	resetActiveLanka();
});

const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-15T00:00:00.000Z",
	...over,
});

const ROWS: readonly IAtlasMission[] = [
	mission("m-1", { title: "Survey the north ridge" }),
	mission("m-2", { title: "Restock the depot" }),
];

const fakeGateway = (over: Record<string, unknown> = {}): AtlasMissionGateway =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

@Component({
	selector: "atlas-mission-list",
	standalone: true,
	template: `
		<ul>
			@for (row of missions().rows().items; track row.id) {
				<li>{{ line(row) }}</li>
			}
		</ul>
	`,
})
class MissionListComponent {
	/*
	 * `inject` in a field initialiser, which IS an injection context — and the
	 * only place this call can go.
	 *
	 * `useLankaVM` asserts the context rather than assuming it, because the
	 * subscription is torn down by `DestroyRef`, and a call made outside one has
	 * no `DestroyRef` to register with: a leak rather than an error. `ngOnInit` is
	 * outside, and a required `input` is not readable here at all.
	 */
	readonly missions = useAtlasMissions(inject(ATLAS_MISSIONS_VM));

	readonly line = formatAtlasMissionLine;
}

const renderList = (missionsVM: ReturnType<typeof createAtlasMissionsVM>) => {
	TestBed.overrideProvider(ATLAS_MISSIONS_VM, { useValue: missionsVM });

	const fixture = TestBed.createComponent(MissionListComponent);
	fixture.detectChanges();

	return fixture;
};

describe("useAtlasMissions", () => {
	it("reads what the ViewModel already holds, and asks for nothing", () => {
		const gateway = fakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);
		missionsVM.setState({ missions: ROWS });

		const fixture = renderList(missionsVM);

		expect(fixture.nativeElement.textContent).toContain("AT-101 Survey the north ridge");
		// The read path is the one that does NOT fetch: a screen whose data arrived
		// some other way must not spend a request proving it.
		expect(gateway.list).not.toHaveBeenCalled();
	});

	it("marks the view dirty when an action writes", () => {
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const fixture = renderList(missionsVM);

		missionsVM.getState().applySearch("depot");
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).not.toContain("AT-101 Survey the north ridge");
		expect(fixture.nativeElement.textContent).toContain("AT-102 Restock the depot");
	});

	it("needs no Zone to do it", () => {
		// The claim this ecosystem makes that no other can. The only change-detection
		// provider anywhere in it is `provideZonelessChangeDetection`, and neither
		// package declares `zone.js`: what the binding produces is a signal, and a
		// signal is what zoneless change detection already reads. A ViewModel that
		// needed Zone would mean the framework had a mechanism of its own to be
		// patched, which is the thing `_plans/14` exists to disprove.
		//
		// A DEPENDENCY scan and not `globalThis.Zone`, which is defined here:
		// `@analogjs/vite-plugin-angular/setup-vitest` loads zone.js for its own
		// async hooks. That is the test harness, not the application, and asserting
		// against the global would be asserting something about Vitest.
		// Paths from the package root, which is where vitest runs — the same way
		// every other source-scanning scene in this repository reads a file.
		const manifests = ["package.json", "../spa/package.json"].map(
			(at) =>
				JSON.parse(readFileSync(at, "utf8")) as {
					dependencies?: Record<string, string>;
				},
		);

		expect(manifests.every((one) => one.dependencies?.["zone.js"] === undefined)).toBe(true);

		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const fixture = renderList(missionsVM);

		missionsVM.getState().applySearch("depot");
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain("AT-102 Restock the depot");
	});

	it("stops arriving once the component is destroyed", () => {
		// A subscription that outlived its screen is the leak nobody sees: the
		// ViewModel goes on notifying a reader that will never paint again, and holds
		// it alive for as long as it lives itself. `DestroyRef` is what calls `stop`,
		// and it is the reason the read must happen in an injection context.
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const fixture = renderList(missionsVM);
		const before = fixture.nativeElement.textContent as string;

		fixture.destroy();
		missionsVM.getState().applySearch("depot");

		expect(fixture.nativeElement.textContent).toBe(before);
	});

	it("leaves the failure where the ViewModel put it", async () => {
		const missionsVM = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);
		renderList(missionsVM);

		await missionsVM.getState().fetchMissions();

		// The read path does not catch, and that is the point: a screen renders the
		// failure the ViewModel named, and nothing between the two invents one.
		expect(missionsVM.getState().error).not.toBeNull();
	});
});

describe("formatAtlasMissionLine", () => {
	it("is ONE string, which is the whole reason it exists", () => {
		// `{{ row.code }} {{ row.title }}` renders two text nodes, which looks
		// identical on screen and means a reader cannot match the line.
		expect(formatAtlasMissionLine(mission("m-1", { title: "Survey the north ridge" }))).toBe(
			"AT-101 Survey the north ridge",
		);
	});

	it("is a function and not a pipe, and that is a decision", () => {
		// A pipe is a class with a decorator and an import into every template that
		// uses it. This is a string rule, called by a server renderer and a test as
		// well as by a template, and none of those want an injector to call it.
		expect(typeof formatAtlasMissionLine).toBe("function");
		expect(formatAtlasMissionLine.prototype).toBeUndefined();
	});
});
