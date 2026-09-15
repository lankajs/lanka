import { LankaError } from "lanka/errors";
import { createAtlasTelemetryVM } from "@lanka-playgrounds/_shared";
import { renderWithLanka } from "@lankajs/react/testing";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasTelemetryScreen } from "./AtlasTelemetryScreen";
import type { IAtlasTelemetryGateway } from "@lanka-playgrounds/_shared";

const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 3, active: 1, done: 2 })),
		restricted: vi.fn(() =>
			Promise.reject(
				new LankaError({
					kind: "domain",
					message: "the board is not yours to watch",
					code: "PERMISSION_DENIED",
				}),
			),
		),
		...over,
	}) as unknown as IAtlasTelemetryGateway;

const renderScreen = (gateway: IAtlasTelemetryGateway) => {
	const telemetryVM = createAtlasTelemetryVM(gateway);
	renderWithLanka(<AtlasTelemetryScreen telemetryVM={telemetryVM} />);

	return telemetryVM;
};

afterEach(() => {
	cleanup();
});

describe("AtlasTelemetryScreen", () => {
	it("builds its ViewModel on FIRST USE, not at module load", () => {
		// The whole reason a screen most sessions never open is lazy: nothing is
		// built, and nothing is subscribed, until somebody looks at it.
		const gateway = fakeGateway();
		const telemetryVM = createAtlasTelemetryVM(gateway);

		expect(vi.mocked(gateway.summary)).not.toHaveBeenCalled();

		telemetryVM.dispose();
	});

	it("shows what the stream answered", async () => {
		renderScreen(fakeGateway());

		await waitFor(() => expect(screen.getByTestId("telemetry").textContent).toBe("2 done"));
	});

	it("shows a refusal in the server's own words", async () => {
		// `PERMISSION_DENIED` arrives as a `domain` failure carrying the status
		// NAME rather than the number — a line somebody can read beats a line
		// somebody has to look up.
		renderScreen(fakeGateway());

		fireEvent.click(screen.getByText("Ask for the restricted stream"));

		await waitFor(() =>
			expect(screen.getByTestId("refusal").textContent).toBe(
				"the board is not yours to watch",
			),
		);
	});

	it("says nothing when the restricted call is allowed after all", async () => {
		renderScreen(
			fakeGateway({
				restricted: vi.fn(() => Promise.resolve({ queued: 0, active: 0, done: 0 })),
			}),
		);

		fireEvent.click(screen.getByText("Ask for the restricted stream"));

		await waitFor(() => expect(screen.queryByTestId("refusal")).toBeNull());
	});

	it("disposes the ViewModel when the screen goes", () => {
		// A lazy ViewModel subscribes to scenarios on first use. Without explicit
		// disposal that subscription outlives the screen and keeps reacting to
		// facts about a panel nobody is looking at.
		//
		// Counted through a hand-written delegate, not `vi.spyOn`.
		//
		// A lazy ViewModel is a Proxy that ANSWERS reads without owning properties,
		// so it has no descriptor for `dispose` — and `spyOn` asks for one before it
		// replaces anything, then reports "dispose does not exist". That is the
		// laziness working: owning the property would mean building the store to
		// describe it.
		const real = createAtlasTelemetryVM(fakeGateway());
		let disposals = 0;
		const telemetryVM = {
			name: real.name,
			isAccessTracked: real.isAccessTracked,
			getState: () => real.getState(),
			subscribe: (listener: Parameters<typeof real.subscribe>[0]) => real.subscribe(listener),
			dispose: () => {
				disposals += 1;
				real.dispose();
			},
		} as unknown as typeof real;

		renderWithLanka(<AtlasTelemetryScreen telemetryVM={telemetryVM} />);
		cleanup();

		expect(disposals).toBe(1);
	});
});
