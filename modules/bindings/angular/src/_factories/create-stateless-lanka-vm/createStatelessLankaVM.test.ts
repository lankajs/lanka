import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createEnvironmentInjector,
	EnvironmentInjector,
	provideZonelessChangeDetection,
	runInInjectionContext,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { createStatelessLankaVM } from "./createStatelessLankaVM";

/**
 * Orchestration with no reactive fields, declared in one line.
 *
 * A stateless ViewModel holds actions and nothing else, so what the call answers
 * is a signal over the actions — and `trackerVM.getState().track()` outside a
 * component is the spelling that needs no injection context at all, which is
 * usually the one an orchestration ViewModel wants.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

afterEach(resetActiveLanka);

const scope = (): EnvironmentInjector =>
	createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

interface ITrackerActions {
	track: (what: string) => void;
}

describe("createStatelessLankaVM (Angular)", () => {
	it("is declared at module level with no injection context anywhere in sight", () => {
		expect(() =>
			createStatelessLankaVM<ITrackerActions>({
				name: "TrackerVM",
				createActions: () => ({ track: vi.fn() }),
			}),
		).not.toThrow();
	});

	it("answers the actions, in a component and outside one", () => {
		const seen: string[] = [];
		const trackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: (what: string) => seen.push(what) }),
		});

		const state = runInInjectionContext(scope(), () => trackerVM());

		state().track("render");
		expect(seen).toContain("render");

		trackerVM.getState().track("outside");
		expect(seen).toContain("outside");
	});

	it("is the ViewModel: name, subscribe and the actions themselves", () => {
		const trackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: vi.fn() }),
		});

		expect(trackerVM.name).toBe("TrackerVM");
		expect(typeof trackerVM.subscribe).toBe("function");
		expect(typeof trackerVM.getState().track).toBe("function");
	});
});
