import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { For, createEffect, createRoot } from "solid-js";
import { LankaError } from "lanka/errors";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { formatAtlasMissionLine } from "./formatAtlasMissionLine";
import { useAtlasMissions } from "./useAtlasMissions";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The ecosystem's read path, driven by Solid's own reactivity.
 *
 * Two shapes of scene, because Solid asks two different questions. A rendered
 * component answers "what is on the screen"; a `createRoot` with an effect in it
 * answers "how many times did the reader run", which in a framework with no
 * re-render is the closest thing to counting renders.
 *
 * `.tsx` and its own tsconfig: Solid compiles JSX into its own reactive calls
 * with its own `JSX` namespace, and a Solid component checked under React's
 * setting has every element typed as `React.JSX.Element`.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	cleanup();
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

const MissionList = (props: { missionsVM: ReturnType<typeof createAtlasMissionsVM> }) => {
	const missions = useAtlasMissions(props.missionsVM);

	return (
		<ul>
			<For each={missions().rows().items}>
				{(row) => <li>{formatAtlasMissionLine(row)}</li>}
			</For>
		</ul>
	);
};

describe("useAtlasMissions", () => {
	it("reads what the ViewModel already holds, and asks for nothing", () => {
		const gateway = fakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);
		missionsVM.setState({ missions: ROWS });

		render(() => <MissionList missionsVM={missionsVM} />);

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeTruthy();
		// The read path is the one that does NOT fetch: a screen whose data arrived
		// some other way must not spend a request proving it.
		expect(gateway.list).not.toHaveBeenCalled();
	});

	it("moves the DOM when an action writes, without re-running the component", () => {
		// The sentence that separates Solid from every other member of the shelf: a
		// component runs ONCE, and what updates is the node that read the accessor.
		// A binding that forced a component re-render would pass the assertion below
		// and fail this counter.
		const ran = vi.fn();
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });

		const Counted = (props: { missionsVM: typeof missionsVM }) => {
			ran();

			return <MissionList missionsVM={props.missionsVM} />;
		};

		render(() => <Counted missionsVM={missionsVM} />);
		missionsVM.getState().applySearch("depot");

		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeTruthy();
		expect(ran).toHaveBeenCalledTimes(1);
	});

	it("re-runs a reading EFFECT for every write, because this ViewModel turned tracking OFF", () => {
		// Access tracking re-runs a reader only for the keys it read through the
		// recording proxy, and `rows()` reads `missions`, `search`, `sort` and `page`
		// inside itself via `get()` — past the proxy. A screen linked to the list
		// only through that call would freeze with no error anywhere, so
		// `createAtlasMissionsVM` sets `enableAccessTrackingOptimization: false`.
		//
		// The documented consequence is this: a write to a key nothing here reads
		// still re-runs the reader. One redundant pass is the price of a screen that
		// cannot go stale, and this scene is what stops somebody removing it.
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const seen: number[] = [];

		const dispose = createRoot((disposeRoot) => {
			const missions = useAtlasMissions(missionsVM);

			createEffect(() => {
				seen.push(missions().rows().items.length);
			});

			return disposeRoot;
		});

		missionsVM.setState({ error: "a key the list never read" });

		expect(missionsVM.isAccessTracked).toBe(false);
		expect(seen.length).toBeGreaterThan(1);
		dispose();
	});

	it("stops arriving once the owner is disposed", () => {
		// A subscription that outlived its screen is the leak nobody sees: the
		// ViewModel goes on notifying a reader that will never paint again, and holds
		// it alive for as long as it lives itself. Solid's owner is what calls `stop`.
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		const seen: number[] = [];

		const dispose = createRoot((disposeRoot) => {
			const missions = useAtlasMissions(missionsVM);

			createEffect(() => {
				seen.push(missions().rows().items.length);
			});

			return disposeRoot;
		});
		const afterFirst = seen.length;
		dispose();

		missionsVM.getState().applySearch("depot");

		expect(seen).toHaveLength(afterFirst);
	});

	it("leaves the failure where the ViewModel put it", async () => {
		const missionsVM = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);

		render(() => <MissionList missionsVM={missionsVM} />);
		await missionsVM.getState().fetchMissions();

		// The read path does not catch, and that is the point: a screen renders the
		// failure the ViewModel named, and nothing between the two invents one.
		expect(missionsVM.getState().error).not.toBeNull();
	});
});

describe("formatAtlasMissionLine", () => {
	it("is ONE string, which is the whole reason it exists", () => {
		// `{row.code} {row.title}` in JSX renders two text nodes, which looks
		// identical on screen and means a reader cannot match the line.
		expect(formatAtlasMissionLine(mission("m-1", { title: "Survey the north ridge" }))).toBe(
			"AT-101 Survey the north ridge",
		);
	});
});
