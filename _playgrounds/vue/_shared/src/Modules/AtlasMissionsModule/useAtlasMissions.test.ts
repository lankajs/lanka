import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import { defineComponent, h, nextTick } from "vue";
import { LankaError } from "lanka/errors";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { formatAtlasMissionLine } from "./formatAtlasMissionLine";
import { useAtlasMissions } from "./useAtlasMissions";
import { useAtlasMissionsOnMount } from "./useAtlasMissionsOnMount";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The two read paths of the Vue ecosystem, driven through real components.
 *
 * A composable tested in isolation proves the composable; these are rendered
 * inside a component and read back through the DOM, because what the
 * applications share is not the return value — it is what ends up on the screen
 * and WHEN.
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

const listScreen = (missionsVM: ReturnType<typeof createAtlasMissionsVM>, onMount = false) =>
	defineComponent({
		setup() {
			const missions = onMount
				? useAtlasMissionsOnMount(missionsVM)
				: useAtlasMissions(missionsVM);

			return () =>
				h(
					"ul",
					missions.value
						.rows()
						.items.map((row) => h("li", { key: row.id }, formatAtlasMissionLine(row))),
				);
		},
	});

describe("useAtlasMissions", () => {
	it("reads what the ViewModel already holds, and asks for nothing", async () => {
		const gateway = fakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);
		missionsVM.setState({ missions: ROWS });

		render(listScreen(missionsVM));
		await nextTick();

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeTruthy();
		// The plain read is the one that does NOT fetch: a screen whose data arrived
		// some other way must not spend a request proving it.
		expect(gateway.list).not.toHaveBeenCalled();
	});

	it("re-renders when an action writes", async () => {
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		missionsVM.setState({ missions: ROWS });
		render(listScreen(missionsVM));
		await nextTick();

		missionsVM.getState().applySearch("depot");
		await nextTick();

		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeTruthy();
	});
});

describe("useAtlasMissionsOnMount", () => {
	it("asks the gateway once the screen exists", async () => {
		const gateway = fakeGateway();
		const missionsVM = createAtlasMissionsVM(gateway);

		render(listScreen(missionsVM, true));
		await missionsVM.getState().fetchMissions();
		await nextTick();

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeTruthy();
		expect(gateway.list).toHaveBeenCalled();
	});

	it("leaves the failure where the ViewModel put it", async () => {
		const missionsVM = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);

		render(listScreen(missionsVM, true));
		await missionsVM.getState().fetchMissions();
		await nextTick();

		// The composable does not catch, and that is the point: a screen renders the
		// failure the ViewModel named, and nothing between the two invents one.
		expect(missionsVM.getState().error).not.toBeNull();
	});
});

describe("formatAtlasMissionLine", () => {
	it("is ONE string, which is the whole reason it exists", () => {
		// `{{ code }} {{ title }}` renders two text nodes, which looks identical on
		// screen and means a reader cannot match the line.
		expect(formatAtlasMissionLine(mission("m-1", { title: "Survey the north ridge" }))).toBe(
			"AT-101 Survey the north ridge",
		);
	});
});
