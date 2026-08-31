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
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";

type TInit = () => void | Promise<void>;

describe("createLanka — failure propagation", () => {
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

	it("propagates sync errors and stops further tasks", async () => {
		const calls: string[] = [];
		const initFail: TInit = () => {
			calls.push("fail");
			throw new Error("sync fail");
		};
		const initAfter: TInit = () => {
			calls.push("after");
		};

		await expect(
			lanka.bootstrap({
				services: [
					{
						init: initFail,
						sync: true,
						priority: 1,
					},
					{
						init: initAfter,
						sync: true,
						priority: 0,
					},
				],
			}),
		).rejects.toThrow("sync fail");

		expect(calls).toEqual(["fail"]);
		expect(lankaScenarioBootstrap.bootstrap).not.toHaveBeenCalled();
	});

	it("propagates async errors and does not run async scenarios", async () => {
		const initAsync: TInit = () => {
			throw new Error("async fail");
		};

		await expect(
			lanka.bootstrap({
				services: [{ init: initAsync }],
				scenarios: { sync: false },
			}),
		).rejects.toThrow("async fail");

		expect(lankaScenarioBootstrap.bootstrap).not.toHaveBeenCalled();
	});

	it("propagates scenario sync errors and stops remaining sync tasks", async () => {
		const calls: string[] = [];
		const initBefore: TInit = () => {
			calls.push("before");
		};
		const initAfter: TInit = () => {
			calls.push("after");
		};

		(
			lankaScenarioBootstrap.bootstrap as unknown as ReturnType<typeof vi.fn>
		).mockImplementation(() => {
			calls.push("scenario");
			throw new Error("scenario fail");
		});

		await expect(
			lanka.bootstrap({
				services: [
					{
						init: initBefore,
						sync: true,
						priority: 1,
					},
					{
						init: initAfter,
						sync: true,
						priority: -1,
					},
				],
				scenarios: { sync: true, priority: 0 },
			}),
		).rejects.toThrow("scenario fail");

		expect(calls).toEqual(["before", "scenario"]);
	});
});
