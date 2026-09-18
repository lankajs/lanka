import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { LankaError } from "lanka/errors";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { formatAtlasMissionLine } from "./formatAtlasMissionLine";
import { useAtlasMissions } from "./useAtlasMissions";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The ecosystem's read path, driven by Svelte's own reactivity.
 *
 * `.svelte.test.ts` and not `.test.ts`: the suffix is what tells the compiler to
 * treat this module as a rune module, and `$effect.root` is the whole reason it
 * has to. A getter read OUTSIDE an effect answers correctly and subscribes to
 * nothing — so a suite written without a root would assert every value in this
 * file and never once prove that a change arrives.
 *
 * That is also why there is no component here. What the applications share is a
 * function, and a fixture component would put a second thing under test between
 * the assertion and the claim. The compiled screens are asserted in
 * `../../../../spa`, where a compiler is the point.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
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

/**
 * Read the missions through an effect, and record every line the effect saw.
 *
 * The recorded array IS the assertion in most scenes below: its length is how
 * many times Svelte decided this read was stale, and a binding that notified too
 * eagerly would show up here as an extra entry rather than as a wrong value.
 */
const linesSeenBy = (missionsVM: ReturnType<typeof createAtlasMissionsVM>) => {
	const seen: string[][] = [];
	const stopRoot = $effect.root(() => {
		const missions = useAtlasMissions(missionsVM);

		$effect(() => {
			seen.push(missions.rows().items.map(formatAtlasMissionLine));
		});

		return missions.stop;
	});
	flushSync();

	return { seen, stop: stopRoot };
};

describe("useAtlasMissions", () => {
	it("reads what the ViewModel already holds, and asks for nothing", () => {
		const gateway = fakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);
		missionsVM.setState({ missions: ROWS });

		const { seen, stop } = linesSeenBy(missionsVM);

		expect(seen.at(-1)).toContain("AT-101 Survey the north ridge");
		// The read path is the one that does NOT fetch: a screen whose data arrived
		// some other way must not spend a request proving it.
		expect(gateway.list).not.toHaveBeenCalled();
		stop();
	});

	it("re-runs the effect when an action writes", () => {
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const { seen, stop } = linesSeenBy(missionsVM);

		missionsVM.getState().applySearch("depot");
		flushSync();

		expect(seen).toHaveLength(2);
		expect(seen.at(-1)).toEqual(["AT-102 Restock the depot"]);
		stop();
	});

	it("re-runs for EVERY write, because this ViewModel turned tracking OFF on purpose", () => {
		// The seam a consumer meets first, asserted rather than explained. Access
		// tracking re-runs a reader only for the keys it read THROUGH THE PROXY, and
		// `rows()` reads `missions`, `search`, `sort` and `page` inside itself via
		// `get()` — past the proxy. A screen whose only link to the list is that call
		// would never hear about a change to it and would simply freeze, with no
		// error anywhere.
		//
		// So `createAtlasMissionsVM` sets `enableAccessTrackingOptimization: false`,
		// and the documented consequence is this: a write to a key nothing here reads
		// still re-runs the effect. One redundant pass is the price of a screen that
		// cannot go stale, and this scene is what stops somebody turning tracking
		// back on to remove it.
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const { seen, stop } = linesSeenBy(missionsVM);

		missionsVM.setState({ error: "a key the list never read" });
		flushSync();

		expect(missionsVM.isAccessTracked).toBe(false);
		expect(seen).toHaveLength(2);
		stop();
	});

	it("leaves the failure where the ViewModel put it", async () => {
		const missionsVM = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);
		const { stop } = linesSeenBy(missionsVM);

		await missionsVM.getState().fetchMissions();
		flushSync();

		// The read path does not catch, and that is the point: a screen renders the
		// failure the ViewModel named, and nothing between the two invents one.
		expect(missionsVM.getState().error).not.toBeNull();
		stop();
	});

	it("stops arriving once the root is torn down", () => {
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const { seen, stop } = linesSeenBy(missionsVM);

		stop();
		missionsVM.getState().applySearch("depot");
		flushSync();

		// A subscription that outlived its screen is the leak nobody sees: the
		// ViewModel goes on notifying a reader that will never paint again, and holds
		// it alive for as long as it lives itself.
		expect(seen).toHaveLength(1);
	});
});

describe("formatAtlasMissionLine", () => {
	it("is ONE string, which is the whole reason it exists", () => {
		// `{mission.code} {mission.title}` in markup renders two text nodes, which
		// looks identical on screen and means a reader cannot match the line.
		expect(formatAtlasMissionLine(mission("m-1", { title: "Survey the north ridge" }))).toBe(
			"AT-101 Survey the north ridge",
		);
	});
});
