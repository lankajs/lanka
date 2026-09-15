import { LankaError } from "lanka/errors";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { renderWithLanka } from "@lankajs/react/testing";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAtlasHydratedMissions } from "./useAtlasHydratedMissions";
import { useAtlasMissions } from "./useAtlasMissions";
import { useAtlasMissionsOnMount } from "./useAtlasMissionsOnMount";
import { ATLAS_ROWS, atlasFakeGateway, atlasMission } from "../../_Testing/atlasMissionFixtures";
import { formatAtlasMissionLine } from "../../Core/Missions/formatAtlasMissionLine";
import type { JSX } from "react";
import type { TAtlasMissionsVM, TAtlasWritableMissionsVM } from "../../index";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The three read paths of the React ecosystem, driven through real components.
 *
 * A hook tested through `renderHook` proves the hook; these are rendered inside
 * a component and read back through the DOM, because what three applications
 * share is not the return value — it is what ends up on the screen and WHEN.
 */
afterEach(cleanup);

const List = ({ missions }: { missions: readonly IAtlasMission[] }): JSX.Element => (
	<ul>
		{missions.map((mission) => (
			<li key={mission.id}>{formatAtlasMissionLine(mission)}</li>
		))}
	</ul>
);

describe("useAtlasMissions", () => {
	it("reads what the ViewModel already holds, and asks for nothing", () => {
		const gateway = atlasFakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);
		missionsVM.setState({ missions: ATLAS_ROWS });

		const Screen = (): JSX.Element => (
			<List missions={useAtlasMissions(missionsVM).rows().items} />
		);
		renderWithLanka(<Screen />);

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined();
		// The plain read is the one that does NOT fetch. A screen whose data
		// arrived some other way must not spend a request proving it.
		expect(gateway.list).not.toHaveBeenCalled();
	});

	it("re-renders when an action writes", async () => {
		const missionsVM = createAtlasMissionsVM(atlasFakeGateway());
		missionsVM.setState({ missions: ATLAS_ROWS });

		const Screen = (): JSX.Element => {
			const { rows, applySearch, search } = useAtlasMissions(missionsVM);

			return (
				<>
					<input
						aria-label="term"
						value={search}
						onChange={(e) => applySearch(e.target.value)}
					/>
					<List missions={rows().items} />
				</>
			);
		};
		renderWithLanka(<Screen />);

		fireEvent.change(screen.getByLabelText("term"), { target: { value: "depot" } });

		await waitFor(() => expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull());
		expect(screen.getByText("AT-102 Restock the depot")).toBeDefined();
	});
});

describe("useAtlasMissionsOnMount", () => {
	it("asks the gateway once the screen exists", async () => {
		const gateway = atlasFakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);

		const Screen = (): JSX.Element => (
			<List missions={useAtlasMissionsOnMount(missionsVM).rows().items} />
		);
		renderWithLanka(<Screen />);

		await waitFor(() =>
			expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined(),
		);
		expect(gateway.list).toHaveBeenCalledTimes(1);
	});

	it("does not fetch again when an unrelated key moves", async () => {
		// The claim the effect's dependency makes: an action is stable for the
		// life of the store, so a re-render is not a second request. A dependency
		// array that held the whole state object would fail this.
		const gateway = atlasFakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);

		const Screen = (): JSX.Element => {
			const { rows, applySearch } = useAtlasMissionsOnMount(missionsVM);

			return (
				<>
					<button type="button" onClick={() => applySearch("depot")}>
						search
					</button>
					<List missions={rows().items} />
				</>
			);
		};
		renderWithLanka(<Screen />);
		await waitFor(() => expect(gateway.list).toHaveBeenCalledTimes(1));

		fireEvent.click(screen.getByText("search"));

		await waitFor(() => expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull());
		expect(gateway.list).toHaveBeenCalledTimes(1);
	});

	it("leaves the failure where the ViewModel put it", async () => {
		const gateway = atlasFakeGateway({
			list: vi.fn(() =>
				Promise.reject(new LankaError({ kind: "network", message: "no route" })),
			),
		});
		const missionsVM = createAtlasMissionsVM(gateway);

		const Screen = (): JSX.Element => {
			const { error, rows } = useAtlasMissionsOnMount(missionsVM);

			return (
				<>
					{error !== null && <p role="alert">{error}</p>}
					<List missions={rows().items} />
				</>
			);
		};
		renderWithLanka(<Screen />);

		// The hook does not catch, and that is the point: a screen renders the
		// failure the ViewModel named, and nothing between the two invents one.
		await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
	});
});

describe("useAtlasHydratedMissions", () => {
	const hydrated = (missionsVM: TAtlasWritableMissionsVM, missions: readonly IAtlasMission[]) => {
		const Screen = (): JSX.Element => (
			<List missions={useAtlasHydratedMissions(missionsVM, missions).rows().items} />
		);

		return renderWithLanka(<Screen />);
	};

	it("paints the server's rows on the first frame, with no request", () => {
		const gateway = atlasFakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);

		hydrated(missionsVM, ATLAS_ROWS);

		// Synchronously — no `waitFor`. That assertion IS the feature: an effect
		// would have painted an empty list first and this row on the second frame.
		expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined();
		expect(gateway.list).not.toHaveBeenCalled();
	});

	it("applies once — a second render with other data changes nothing", () => {
		const missionsVM = createAtlasMissionsVM(atlasFakeGateway());
		const { rerender } = hydrated(missionsVM, ATLAS_ROWS);

		const Other = (): JSX.Element => (
			<List
				missions={
					useAtlasHydratedMissions(missionsVM, [
						atlasMission("m-9", { title: "Never hydrated" }),
					]).rows().items
				}
			/>
		);
		rerender(<Other />);

		expect(screen.queryByText("AT-109 Never hydrated")).toBeNull();
		expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined();
	});

	it("hands back a ViewModel a screen can keep reading", async () => {
		const missionsVM = createAtlasMissionsVM(atlasFakeGateway());
		hydrated(missionsVM, ATLAS_ROWS);

		// Hydration is the first paint; every change after it is an action — so
		// the hydrated store is an ordinary store, not a frozen snapshot.
		missionsVM.getState().applySearch("depot");

		await waitFor(() => expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull());
	});
});

describe("the two ViewModel types", () => {
	it("keeps setState out of what a screen is given", () => {
		const missionsVM = createAtlasMissionsVM(atlasFakeGateway());
		const readable: TAtlasMissionsVM = missionsVM;
		const writable: TAtlasWritableMissionsVM = missionsVM;

		// The narrower type is a compile-time promise, so the runtime assertion
		// can only be that the same object satisfies both — which is what lets a
		// host hydrate the very ViewModel it hands a screen.
		expect(readable).toBe(writable);
		expect("setState" in readable).toBe(true);
	});
});
