import { LankaError } from "lanka/errors";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { renderWithLanka } from "@lankajs/tool-testing";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasMissionsScreen } from "./AtlasMissionsScreen";
import { createAtlasAvatarCache } from "../../Core/Services/createAtlasAvatarCache";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";

const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-13T00:00:00.000Z",
	...over,
});

const ROWS = [
	mission("m-1", { title: "Survey the north ridge", crewId: "c-1" }),
	mission("m-2", { title: "Restock the depot" }),
	mission("m-3", { title: "Repair the relay mast" }),
	mission("m-4", { title: "Map the flood plain" }),
];

const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

/**
 * A cache with no storage under it at all.
 *
 * The memory rung behaves exactly as no cache does, so a component test over it
 * is testing the component rather than IndexedDB — and `createObjectUrl` is
 * stubbed because jsdom has none, which is the same reason the real one is
 * allowed to answer `null`.
 */
const avatars = () =>
	createAtlasAvatarCache({
		indexedDb: undefined,
		caches: undefined,
		now: () => 0,
		createObjectUrl: () => "blob:atlas",
		revokeObjectUrl: () => undefined,
	});

const renderScreen = async (gateway: AtlasMissionGateway) => {
	const useMissionsVM = createAtlasMissionsVM(gateway);
	const rendered = renderWithLanka(
		<AtlasMissionsScreen useMissionsVM={useMissionsVM} avatars={avatars()} />,
	);
	await waitFor(() => expect(screen.getByText("Survey the north ridge")).toBeDefined());

	return { ...rendered, useMissionsVM };
};

afterEach(() => {
	cleanup();
});

describe("AtlasMissionsScreen", () => {
	it("renders what the ViewModel loaded, and nothing it did not ask for", async () => {
		await renderScreen(fakeGateway());

		expect(screen.getByText("Restock the depot")).toBeDefined();
		// Four rows, three to a page: the fourth is on page two rather than
		// missing, and the footer says so.
		expect(screen.getByTestId("page").textContent).toBe("1 / 2");
	});

	it("shows a failure the ViewModel put there, and owns no error state of its own", async () => {
		// A `LankaError`, because that is what leaves a request. Anything else is
		// a bug in a handler, and the application RETHROWS those rather than
		// showing them: swallowing a `TypeError` into a banner is how a defect
		// becomes "the server is down".
		const useMissionsVM = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "No connection" })),
				),
			}),
		);
		renderWithLanka(<AtlasMissionsScreen useMissionsVM={useMissionsVM} avatars={avatars()} />);

		await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No connection"));
	});

	it("filters as somebody types", async () => {
		await renderScreen(fakeGateway());

		fireEvent.change(screen.getByLabelText("Search missions"), { target: { value: "depot" } });

		await waitFor(() => expect(screen.queryByText("Survey the north ridge")).toBeNull());
		expect(screen.getByText("Restock the depot")).toBeDefined();
	});

	it("pages, and cannot page past the end", async () => {
		await renderScreen(fakeGateway());

		fireEvent.click(screen.getByText("Next"));

		await waitFor(() => expect(screen.getByTestId("page").textContent).toBe("2 / 2"));
		expect(screen.getByText("Next").hasAttribute("disabled")).toBe(true);
	});

	it("shows a completion the moment it is pressed, before the server answers", async () => {
		// The optimistic write is the point: the row changes now, and the request
		// happens behind it. Without that the button feels like the network.
		await renderScreen(fakeGateway());

		fireEvent.click(screen.getByText("Complete AT-102"));

		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("done"));
	});

	it("puts the row back when the server refuses", async () => {
		// The row has to be seen going to `done` FIRST, or this test passes over a
		// button that did nothing at all: `queued` is also the value it started at.
		let refuse: () => void = () => undefined;
		await renderScreen(
			fakeGateway({
				complete: vi.fn(
					() =>
						new Promise((_resolve, reject) => {
							refuse = () =>
								reject(new LankaError({ kind: "domain", message: "already done" }));
						}),
				),
			}),
		);

		fireEvent.click(screen.getByText("Complete AT-102"));
		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("done"));

		refuse();

		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("queued"));
	});

	it("renders a crew member's face from the cache's own answer", async () => {
		await renderScreen(fakeGateway());

		const avatar = screen.getByAltText("c-1");

		// The network URL on a first mount: nothing was cached yet, and nothing
		// upgrades an image that is already on screen. That IS the no-flicker
		// guarantee rather than a gap in it.
		expect(avatar.getAttribute("src")).toBe("/api/crew/c-1/avatar.png");
	});
});
