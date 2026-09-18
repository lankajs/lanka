import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LankaError } from "lanka/errors";
import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { ATLAS_MISSIONS_VM } from "@lanka-playgrounds/angular-shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { AtlasApp } from "./App/AtlasApp";
import { AtlasBoardScreen } from "./Modules/AtlasBoardModule/AtlasBoardScreen";
import { ATLAS_BOARD_VM } from "./Modules/AtlasBoardModule/atlasBoardVM";
import { AtlasMissionsScreen } from "./Modules/AtlasMissionsModule/AtlasMissionsScreen";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";

/**
 * Atlas in Angular, asserting what the other four applications assert.
 *
 * Deliberately the same claims in the same words. Five applications saying the
 * same sentences about the same ViewModels is what a `parallel` shelf means, and
 * reading them side by side should show only each framework's own syntax.
 *
 * `provideZonelessChangeDetection` in every scene, and `zone.js` in no manifest:
 * what the binding produces is a signal, and a signal is what zoneless change
 * detection already reads.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
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

const fakeMissionGateway = (over: Record<string, unknown> = {}): AtlasMissionGateway =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

const fakeBoardGateway = (): AtlasBoardGateway =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 2, active: 1, done: 0 })),
		post: vi.fn(() => Promise.resolve({ text: "ack", at: "2026-09-15T00:00:00.000Z" })),
	}) as unknown as AtlasBoardGateway;

/**
 * One injector, one set of ViewModels, per scene.
 *
 * The lifetime question every other ecosystem answers in its shell, Angular
 * answers here — which is also why a scene can mount the shell twice without
 * anything being shared.
 */
const configure = (missionGateway: AtlasMissionGateway, boardGateway = fakeBoardGateway()) => {
	const missionsVM = createAtlasMissionsVM(missionGateway);
	const boardVM = new AtlasBoardVM(boardGateway).build();

	TestBed.configureTestingModule({
		providers: [
			provideZonelessChangeDetection(),
			{ provide: ATLAS_MISSIONS_VM, useValue: missionsVM },
			{ provide: ATLAS_BOARD_VM, useValue: boardVM },
		],
	});

	return { missionsVM, boardVM };
};

const missionsScreen = async (gateway: AtlasMissionGateway) => {
	const { missionsVM } = configure(gateway);
	const fixture = TestBed.createComponent(AtlasMissionsScreen);
	fixture.detectChanges();
	await missionsVM.getState().fetchMissions();
	fixture.detectChanges();

	return { fixture, missionsVM };
};

const text = (fixture: { nativeElement: HTMLElement }): string =>
	fixture.nativeElement.textContent ?? "";

const findByText = (fixture: { nativeElement: HTMLElement }, label: string): HTMLElement => {
	const found = [...fixture.nativeElement.querySelectorAll("button")].find((one) =>
		(one.textContent ?? "").includes(label),
	);

	if (!found) throw new Error(`no button reading ${label}`);

	return found;
};

describe("a compiled component reading a ViewModel", () => {
	it("renders what the ViewModel holds", async () => {
		const { fixture } = await missionsScreen(fakeMissionGateway());

		expect(text(fixture)).toContain("Survey the north ridge");
		expect(text(fixture)).toContain("Restock the depot");
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		const { fixture, missionsVM } = await missionsScreen(fakeMissionGateway());

		missionsVM.getState().applySearch("depot");
		fixture.detectChanges();

		expect(text(fixture)).not.toContain("Survey the north ridge");
		expect(text(fixture)).toContain("Restock the depot");
	});

	it("shows the failure the ViewModel named", async () => {
		// The screen owns no error state and catches nothing: the ViewModel decided
		// what a failure means, and the template reads the word it wrote.
		const { fixture, missionsVM } = await missionsScreen(
			fakeMissionGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);

		expect(missionsVM.getState().error).not.toBeNull();
		expect(fixture.nativeElement.querySelector("[role=alert]")?.textContent?.trim()).toBe(
			missionsVM.getState().error,
		);
	});

	it("routes a typed search through the ViewModel and back to the DOM", async () => {
		const { fixture, missionsVM } = await missionsScreen(fakeMissionGateway());
		const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;

		input.value = "ridge";
		input.dispatchEvent(new Event("input"));
		fixture.detectChanges();

		// A whole round trip with only Angular's syntax in it: a template binding
		// called an action, the ViewModel notified, and the signal marked the view.
		expect(missionsVM.getState().search).toBe("ridge");
		expect(text(fixture)).not.toContain("Restock the depot");
	});

	it("sorts by priority through the action", async () => {
		const { fixture, missionsVM } = await missionsScreen(fakeMissionGateway());

		findByText(fixture, "Sort by priority").click();

		expect(missionsVM.getState().currentSort().field).toBe("priority");
	});

	it("completes a mission through the action, not through the gateway", async () => {
		// A screen that reached the gateway directly would take on the loading flag,
		// the retry and the rollback, and implement none of them.
		const gateway = fakeMissionGateway();
		const { fixture } = await missionsScreen(gateway);

		findByText(fixture, "Complete AT-101").click();
		await Promise.resolve();

		// The FIRST argument only. The second is a deadline signal the framework
		// adds on the way out.
		expect(gateway.complete).toHaveBeenCalled();
		expect(vi.mocked(gateway.complete).mock.calls[0]?.[0]).toBe("m-1");
	});

	it("shows the page the ViewModel derived, and disables what cannot move", async () => {
		const { fixture } = await missionsScreen(fakeMissionGateway());

		// One page of two rows, so both ends are dead — and a screen that let a
		// reader press them would be asking for a page the ViewModel has said does
		// not exist.
		expect(fixture.nativeElement.querySelector("[data-testid=page]")?.textContent).toContain(
			"1 /",
		);
		expect(findByText(fixture, "Previous").hasAttribute("disabled")).toBe(true);
		expect(findByText(fixture, "Next").hasAttribute("disabled")).toBe(true);
	});

	it("moves a page when there is one to move to", async () => {
		const manyRows = Array.from({ length: 25 }, (_, index) => mission(`m-${index + 1}`));
		const { fixture, missionsVM } = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);

		findByText(fixture, "Next").click();

		expect(missionsVM.getState().page).toBe(2);
	});

	it("fetches ONCE, from the mount hook and not the constructor", async () => {
		// A constructor that started a request would make the component impossible
		// to construct without one — which is what every other screen in this folder
		// avoids by using its framework's mount hook.
		const gateway = fakeMissionGateway();
		const { fixture } = await missionsScreen(gateway);

		fixture.detectChanges();
		fixture.detectChanges();

		expect(gateway.list).toHaveBeenCalledTimes(2);
	});
});

describe("the board screen, over the same ViewModel every other application reads", () => {
	it("paints the summary a gateway answered with", async () => {
		const { boardVM } = configure(fakeMissionGateway());
		const fixture = TestBed.createComponent(AtlasBoardScreen);
		fixture.detectChanges();

		await boardVM.getState().fetchSummary();
		fixture.detectChanges();

		expect(
			fixture.nativeElement.querySelector("[data-testid=board-summary]")?.textContent?.trim(),
		).toBe("2 queued");
	});

	it("paints a message that arrived from somewhere else entirely", () => {
		const { boardVM } = configure(fakeMissionGateway());
		const fixture = TestBed.createComponent(AtlasBoardScreen);
		fixture.detectChanges();

		// `setState` and not an action, standing in for the scenario subscription a
		// live stream drives. The screen cannot tell the two apart, which is the
		// property that makes a ViewModel portable in the first place.
		boardVM.setState({ messages: [{ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" }] });
		fixture.detectChanges();

		expect(
			fixture.nativeElement.querySelector("[data-testid=board-messages]")?.textContent,
		).toContain("ridge clear");
	});

	it("says so when there is no summary yet", () => {
		configure(fakeMissionGateway());
		const fixture = TestBed.createComponent(AtlasBoardScreen);
		fixture.detectChanges();

		expect(
			fixture.nativeElement.querySelector("[data-testid=board-summary]")?.textContent?.trim(),
		).toBe("no summary");
	});
});

describe("the shell, over one injector", () => {
	it("renders both screens", () => {
		configure(fakeMissionGateway());
		const fixture = TestBed.createComponent(AtlasApp);
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector("[aria-label=Missions]")).toBeTruthy();
		expect(fixture.nativeElement.querySelector("[aria-label=Board]")).toBeTruthy();
	});

	it("holds no ViewModel of its own, which is what makes it four lines", () => {
		// In every other ecosystem the shell CONSTRUCTS the ViewModels, because a
		// prop is the only way to hand a component one. Here they arrive from the
		// injector, so the lifetime question is answered by a provider — and the
		// shell has nothing left to do but name its children.
		configure(fakeMissionGateway());
		const fixture = TestBed.createComponent(AtlasApp);

		// `__ngContext__` excluded: Angular writes it onto every component instance,
		// and a scan that counted it would be counting the framework rather than the
		// file.
		const own = Object.keys(fixture.componentInstance).filter((key) => !key.startsWith("__"));

		expect(own).toHaveLength(0);
	});
});

describe("the arms a settled screen never shows", () => {
	it("shows the loading status while a fetch is in flight", async () => {
		// The spinner belongs to the ViewModel, not to the screen: `isLoading` is a
		// key it writes, and the template reads it. A screen with a flag of its own
		// would have two answers to one question.
		let release: (rows: IAtlasMission[]) => void = () => undefined;
		const { missionsVM } = configure(
			fakeMissionGateway({
				list: vi.fn(
					() =>
						new Promise<IAtlasMission[]>((resolve) => {
							release = resolve;
						}),
				),
			}),
		);
		const fixture = TestBed.createComponent(AtlasMissionsScreen);
		fixture.detectChanges();

		const inFlight = missionsVM.getState().fetchMissions();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector("[role=status]")?.textContent).toContain(
			"Loading",
		);

		release([...ROWS]);
		await inFlight;
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector("[role=status]")).toBeNull();
	});

	it("moves BACK a page, which the first page can never reach", async () => {
		const manyRows = Array.from({ length: 25 }, (_, index) => mission(`m-${index + 1}`));
		const { fixture, missionsVM } = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);
		findByText(fixture, "Next").click();
		fixture.detectChanges();

		findByText(fixture, "Previous").click();

		expect(missionsVM.getState().page).toBe(1);
	});

	it("repaints the page COUNT when a filter makes pages disappear underneath a reader", async () => {
		// Being stranded on page 2 of a list that now has one page is the bug this
		// scene exists for, and it is the ViewModel's answer either way — the screen
		// only re-reads `totalPages`, which nothing else here makes change.
		const manyRows = Array.from({ length: 25 }, (_, index) =>
			mission(`m-${index + 1}`, {
				title: index === 0 ? "Restock the depot" : `Mission ${index}`,
			}),
		);
		const { fixture, missionsVM } = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);
		findByText(fixture, "Next").click();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector("[data-testid=page]")?.textContent?.trim()).toBe(
			"2 / 9",
		);

		missionsVM.getState().applySearch("depot");
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector("[data-testid=page]")?.textContent?.trim()).toBe(
			"1 / 1",
		);
	});
});
