import { renderWithLanka } from "@lankajs/react/testing";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasApp } from "./AtlasApp";
import { createAtlasAvatarCache } from "../Core/Services/createAtlasAvatarCache";
import type { IAtlasBrowser } from "../startAtlasBrowser";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

const mission: IAtlasMission = {
	id: "m-1",
	code: "AT-101",
	title: "Survey the north ridge",
	status: "active",
	priority: 1,
	crewId: "c-1",
	updatedAt: "2026-09-13T00:00:00.000Z",
};

/**
 * A whole started application, with nothing behind it that opens a connection.
 *
 * Every seam this double stands in for is one the real application also injects:
 * the gateways, the channel and the session are constructor arguments or fields
 * of the started app, so a test replaces them without touching a screen.
 */
const fakeBrowser = (): IAtlasBrowser =>
	({
		app: {
			session: { current: () => ({ name: "Ada" }) },
			missionGateway: {
				list: vi.fn(() => Promise.resolve([mission])),
				complete: vi.fn(() => Promise.resolve(mission)),
				remove: vi.fn(() => Promise.resolve({ id: mission.id })),
				create: vi.fn(() => Promise.resolve(mission)),
			},
			boardGateway: {
				summary: vi.fn(() => Promise.resolve({ queued: 1, active: 1, forecast: null })),
			},
			telemetryGateway: {
				summary: vi.fn(() => Promise.resolve({ queued: 1, active: 1, done: 0 })),
				restricted: vi.fn(() => Promise.resolve({ queued: 0, active: 0, done: 0 })),
			},
		},
		channel: { send: vi.fn(() => true), isOpen: () => true },
		cache: {},
		stop: vi.fn(),
	}) as unknown as IAtlasBrowser;

const avatars = () =>
	createAtlasAvatarCache({
		indexedDb: undefined,
		caches: undefined,
		now: () => 0,
		createObjectUrl: () => "blob:atlas",
		revokeObjectUrl: () => undefined,
	});

afterEach(() => {
	cleanup();
});

describe("AtlasApp", () => {
	it("puts every screen on the page at once", async () => {
		renderWithLanka(<AtlasApp browser={fakeBrowser()} avatars={avatars()} />);

		await waitFor(() => expect(screen.getByText("Survey the north ridge")).toBeDefined());
		for (const region of ["Missions", "Board", "Dispatch", "Telemetry"]) {
			expect(screen.getByLabelText(region)).toBeDefined();
		}
	});

	it("says who is signed in", () => {
		renderWithLanka(<AtlasApp browser={fakeBrowser()} avatars={avatars()} />);

		expect(screen.getByTestId("operator").textContent).toBe("Ada");
	});

	it("says so when nobody is", () => {
		const browser = fakeBrowser();
		browser.app.session.current = () => null;

		renderWithLanka(<AtlasApp browser={browser} avatars={avatars()} />);

		expect(screen.getByTestId("operator").textContent).toBe("signed out");
	});

	it("builds its ViewModels once per application rather than once per render", async () => {
		// A module-level ViewModel would be one store per PROCESS: right for a
		// browser tab, wrong for a suite, and wrong for a server. Building them in
		// a memo is what lets this component be mounted twice in one process.
		const browser = fakeBrowser();
		const { rerender } = renderWithLanka(<AtlasApp browser={browser} avatars={avatars()} />);
		await waitFor(() => expect(screen.getByText("Survey the north ridge")).toBeDefined());

		rerender(<AtlasApp browser={browser} avatars={avatars()} />);

		expect(vi.mocked(browser.app.missionGateway.list).mock.calls.length).toBe(1);
	});
});
