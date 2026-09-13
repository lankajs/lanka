import { LankaError } from "lanka/errors";
import { lankaScenarioBootstrap } from "lanka/scenario";
import { resetLanka } from "@lankajs/tool-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasBoardVM } from "./AtlasBoardVM";
import { atlasBoardMessagePosted } from "../../Scenarios/Scenarios/AtlasBoardMessagePosted/atlasBoardMessagePosted";
import type { AtlasBoardGateway } from "../../Gateways/AtlasBoardGateway/AtlasBoardGateway";

const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 3, active: 1, forecast: null })),
		...over,
	}) as unknown as AtlasBoardGateway;

/** The class style, built and bound the way an application builds one. */
const bound = async (gateway: AtlasBoardGateway) => {
	const useVM = new AtlasBoardVM(gateway).build();
	useVM.getState();
	await resetLanka().bootstrap();
	lankaScenarioBootstrap.bootstrap();

	return useVM;
};

describe("AtlasBoardVM — a ViewModel written as a class", () => {
	beforeEach(() => {
		resetLanka();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("fetches the summary through the gateway it was given", async () => {
		const useVM = new AtlasBoardVM(fakeGateway()).build();

		await useVM.getState().fetchSummary();

		expect(useVM.getState().summary?.queued).toBe(3);
		expect(useVM.getState().error).toBeNull();
	});

	it("puts a failure on the screen rather than throwing at whoever pressed", async () => {
		const useVM = new AtlasBoardVM(
			fakeGateway({
				summary: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "No connection" })),
				),
			}),
		).build();

		await useVM.getState().fetchSummary();

		expect(useVM.getState().error).toBe("No connection");
	});

	it("hears a message somebody else posted", async () => {
		const useVM = await bound(fakeGateway());

		atlasBoardMessagePosted.trigger({ text: "north ridge clear", at: "2026-09-13T00:00:00Z" });

		expect(useVM.getState().messages.map((one) => one.text)).toEqual(["north ridge clear"]);
	});

	it("ignores an announcement that carried nothing", async () => {
		const useVM = await bound(fakeGateway());

		atlasBoardMessagePosted.trigger();

		expect(useVM.getState().messages).toEqual([]);
	});

	it("takes a message handed to it directly, without a scenario", async () => {
		const useVM = new AtlasBoardVM(fakeGateway()).build();

		useVM.getState().applyMessage({ text: "relay mast up", at: "2026-09-13T00:00:00Z" });

		expect(useVM.getState().messages).toHaveLength(1);
	});

	it("polls for what nobody pushes, starting immediately", async () => {
		// A board that waits fifteen seconds for its first number looks broken on
		// arrival.
		const gateway = fakeGateway();
		const useVM = new AtlasBoardVM(gateway).build();

		useVM.getState().startPolling();
		await vi.waitFor(() => expect(vi.mocked(gateway.summary)).toHaveBeenCalled());

		useVM.getState().stopPolling();
	});

	it("starts polling once, however many times it is asked", async () => {
		// Two loops over one screen is two requests per interval, forever, and the
		// second has no id anybody kept.
		const gateway = fakeGateway();
		const useVM = new AtlasBoardVM(gateway).build();

		useVM.getState().startPolling();
		useVM.getState().startPolling();
		await vi.waitFor(() => expect(vi.mocked(gateway.summary)).toHaveBeenCalled());
		useVM.getState().stopPolling();

		expect(vi.mocked(gateway.summary).mock.calls.length).toBeLessThanOrEqual(2);
	});

	it("stops when the screen goes, because a timer holds the closure around it", async () => {
		const gateway = fakeGateway();
		const useVM = new AtlasBoardVM(gateway).build();
		useVM.getState().startPolling();
		await vi.waitFor(() => expect(vi.mocked(gateway.summary)).toHaveBeenCalled());

		useVM.getState().stopPolling();
		const after = vi.mocked(gateway.summary).mock.calls.length;
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(vi.mocked(gateway.summary).mock.calls.length).toBe(after);
	});
});
