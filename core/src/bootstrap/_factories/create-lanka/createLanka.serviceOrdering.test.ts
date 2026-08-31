import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printBootstrapLog: vi.fn(),
	},
}));

vi.mock("../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap", () => ({
	lankaScenarioBootstrap: {
		bootstrap: vi.fn(),
		// A mock factory replaces the module ENTIRELY: a method missing here is not
		// "taken from the real one", it simply does not exist — and the failure
		// arrives from a file this test never mentions.
		adoptDeclaredViewModels: vi.fn(),
	},
}));

import { createLanka } from "./createLanka";
import { resetActiveLanka } from "../../reset-active-lanka/resetActiveLanka";
import type { ILankaInstance } from "./createLanka";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";

type TInit = () => void | Promise<void>;

describe("createLanka — service ordering", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		resetActiveLanka();
		lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		(
			lankaScenarioBootstrap.bootstrap as unknown as ReturnType<typeof vi.fn>
		).mockImplementation(() => {});
	});

	// The defect: the scenario phase was `{ sync: true, ...config.scenarios }`, so a
	// caller forwarding its own optional config — `scenarios: { sync: maybe }` —
	// put `undefined` over the default and moved the whole scenario layer out of
	// the sync phase. Nothing failed; the layer simply ran later than the services
	// that expected it.
	it("keeps the sync phase when `sync` is passed as undefined", async () => {
		const calls: string[] = [];

		(
			lankaScenarioBootstrap.bootstrap as unknown as ReturnType<typeof vi.fn>
		).mockImplementation(() => {
			calls.push("scenarios");
		});

		await lanka.bootstrap({
			services: [
				{
					init: async () => {
						calls.push("async");
						return Promise.resolve();
					},
				},
			],
			scenarios: { sync: undefined, priority: undefined },
		});

		expect(calls).toEqual(["scenarios", "async"]);
	});

	it("runs sync services by priority and scenarios sync by default", async () => {
		const calls: string[] = [];
		const initSyncHigh: TInit = () => {
			calls.push("sync-high");
		};
		const initSyncLow: TInit = () => {
			calls.push("sync-low");
		};
		const initAsync: TInit = () => {
			calls.push("async");
		};

		(
			lankaScenarioBootstrap.bootstrap as unknown as ReturnType<typeof vi.fn>
		).mockImplementation(() => {
			calls.push("scenario");
		});

		await lanka.bootstrap({
			services: [
				{
					init: initSyncHigh,
					sync: true,
					priority: 1,
				},
				{
					init: initSyncLow,
					sync: true,
					priority: -1,
				},
				{ init: initAsync },
			],
		});

		expect(calls).toEqual(["sync-high", "scenario", "sync-low", "async"]);
	});

	it("runs scenarios async after async services when configured", async () => {
		const calls: string[] = [];
		const initSync: TInit = () => {
			calls.push("sync");
		};
		const initAsync: TInit = () => {
			calls.push("async");
		};

		(
			lankaScenarioBootstrap.bootstrap as unknown as ReturnType<typeof vi.fn>
		).mockImplementation(() => {
			calls.push("scenario");
		});

		await lanka.bootstrap({
			services: [{ init: initSync, sync: true }, { init: initAsync }],
			scenarios: { sync: false },
		});

		expect(calls).toEqual(["sync", "async", "scenario"]);
	});

	it("skips bootstrap when already initialized", async () => {
		// Idempotency is asserted through the contract — a second call does nothing —
		// rather than by forging an internal flag.
		await lanka.bootstrap();

		const init: TInit = vi.fn();
		vi.mocked(lankaScenarioBootstrap.bootstrap).mockClear();
		vi.mocked(lankaLogger.printBootstrapLog).mockClear();

		await lanka.bootstrap({
			services: [{ init, sync: true }],
		});

		expect(init).not.toHaveBeenCalled();
		expect(lankaScenarioBootstrap.bootstrap).not.toHaveBeenCalled();
		expect(lankaLogger.printBootstrapLog).toHaveBeenCalledWith("LANKA ALREADY BOOTSTRAPPED");
	});

	it("waits for all async services before async scenarios", async () => {
		const calls: string[] = [];
		let resolveFirst: () => void = () => {};
		let resolveSecond: () => void = () => {};

		const firstAsync: TInit = () => {
			calls.push("async-1");
			return new Promise<void>((resolve) => {
				resolveFirst = resolve;
			});
		};

		const secondAsync: TInit = () => {
			calls.push("async-2");
			return new Promise<void>((resolve) => {
				resolveSecond = resolve;
			});
		};

		(
			lankaScenarioBootstrap.bootstrap as unknown as ReturnType<typeof vi.fn>
		).mockImplementation(() => {
			calls.push("scenario");
		});

		const bootstrapPromise = lanka.bootstrap({
			services: [{ init: firstAsync }, { init: secondAsync }],
			scenarios: { sync: false },
		});

		await Promise.resolve();

		expect(calls).toEqual(["async-1", "async-2"]);
		expect(lankaScenarioBootstrap.bootstrap).not.toHaveBeenCalled();

		resolveFirst();
		await Promise.resolve();
		expect(lankaScenarioBootstrap.bootstrap).not.toHaveBeenCalled();

		resolveSecond();
		await bootstrapPromise;

		expect(calls).toEqual(["async-1", "async-2", "scenario"]);
	});

	it("stress: sync services with scenario sync (timing)", async () => {
		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
		const calls: string[] = [];
		const services = Array.from({ length: 200 }, (_, index) => ({
			init: () => {
				calls.push(`sync-${index}`);
			},
			sync: true,
			priority: index % 5,
		}));

		const start = now();
		await lanka.bootstrap({ services });
		const durationMs = now() - start;

		console.info(`bootstrap sync stress duration: ${durationMs.toFixed(2)}ms`);
		expect(calls).toHaveLength(200);
	});

	it("stress: async services with scenario async (timing)", async () => {
		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
		const services = Array.from({ length: 200 }, () => ({
			init: async () => Promise.resolve(),
		}));

		const start = now();
		await lanka.bootstrap({
			services,
			scenarios: { sync: false },
		});
		const durationMs = now() - start;

		console.info(`bootstrap async stress duration: ${durationMs.toFixed(2)}ms`);
		expect(lankaScenarioBootstrap.bootstrap).toHaveBeenCalled();
	});
});
