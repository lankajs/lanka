import { lankaScenarioBootstrap } from "lanka/scenario";
import { resetLanka } from "@lankajs/tool-testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAtlasMissionsVM } from "./ViewModels/AtlasMissionsViewModel/createAtlasMissionsVM";
import { atlasStreamReconnected } from "./Scenarios/Scenarios/AtlasStreamReconnected/atlasStreamReconnected";
import type { AtlasMissionGateway } from "./Gateways/AtlasMissionGateway/AtlasMissionGateway";
import type { IAtlasMission } from "./Core/Interfaces/IAtlasMission";

/**
 * How long a ViewModel's subscription lives, and the edge that has.
 *
 * A ViewModel DECLARES itself to the scenario layer when it is built, and the
 * declaration is deliberately kept when an instance goes away: the next instance
 * has to re-adopt every module-level ViewModel, or a second `createLanka` in one
 * process would know none of them and their handlers would silently never fire.
 * `LankaScenarioBootstrap` says so where the list is declared.
 *
 * The consequence — which is what this file pins — is that a declaration has no
 * counterpart. Nothing un-declares. In an application that is exactly right: a
 * ViewModel is a module-level singleton and outlives every instance anyway.
 *
 * In a TEST that builds ViewModels inside test bodies it is a sharp edge, and
 * the sharp part is that it is invisible: the stale ViewModel's handlers run
 * against the gateway IT was built with, so the symptom appears as an extra call
 * on somebody else's double, or as a rejection from a test that already passed.
 *
 * This is current, intended-where-it-matters behaviour rather than a defect with
 * a fix withheld. It is pinned because it is the kind of thing a refactor
 * changes by accident, and because a consumer meeting it deserves to find a test
 * that names it rather than a day of confusion.
 */
const ROWS: IAtlasMission[] = [
	{
		id: "m-1",
		code: "AT-1",
		title: "Survey the north ridge",
		status: "queued",
		priority: 1,
		crewId: null,
		updatedAt: "2026-09-13T00:00:00.000Z",
	},
];

const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn(() => Promise.resolve(ROWS[0])),
		remove: vi.fn(() => Promise.resolve({ id: "m-1" })),
		...over,
	}) as unknown as AtlasMissionGateway;

describe("a ViewModel built inside a test", () => {
	beforeEach(() => {
		lankaScenarioBootstrap.reset();
	});

	it("still hears a fact after the instance that adopted it is gone", async () => {
		// The stranger is built, never bound by this test, and never disposed.
		const strangerList = vi.fn(() => Promise.resolve([...ROWS]));
		createAtlasMissionsVM(fakeGateway({ list: strangerList })).getState();

		// A LATER, unrelated setup: a fresh instance, a fresh bootstrap.
		const mine = createAtlasMissionsVM(fakeGateway());
		mine.getState();
		await resetLanka().bootstrap();
		lankaScenarioBootstrap.bootstrap();

		atlasStreamReconnected.trigger({ wire: "events" });
		await Promise.resolve();
		await Promise.resolve();

		// The stranger refetched too, through the gateway nobody is looking at any
		// more. `reset()` clears subscriptions; it does not clear DECLARATIONS, and
		// the bootstrap above re-adopted everything ever declared in this process.
		expect(strangerList).toHaveBeenCalled();
	});

	it("is why a suite that builds ViewModels gives each one its own double", () => {
		// The practical rule, and the reason every helper in this package takes a
		// gateway rather than reaching for a shared one: a stale ViewModel calling
		// its OWN double cannot disturb the counts a live test is asserting on.
		const mine = fakeGateway();
		const stranger = fakeGateway();

		expect(mine.list).not.toBe(stranger.list);
	});
});
