import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printGatewayLog: vi.fn(),
	},
}));

vi.mock("../../../_internal/sleep", () => ({
	sleep: vi.fn(() => Promise.resolve()),
}));

import { createLankaMockHandler } from "./createLankaMockHandler";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { sleep } from "../../../_internal/sleep";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "../../../bootstrap/_factories/create-lanka/createLanka";

let lanka: ILankaInstance;

const identityExtractor = (m: any) => m;

describe("createLankaMockHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetActiveLanka();
		lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		lanka.setConfig({ flags: { isMockMode: false } });
	});

	afterEach(() => {
		lanka.setConfig({
			flags: { isMockMode: false },
		});
	});

	it("returns undefined when isMockMode is not enabled", () => {
		lanka.setConfig({
			flags: { isMockMode: false },
		});

		const handler = createLankaMockHandler(async () => "ok", identityExtractor);

		expect(handler).toBeUndefined();
	});

	it("executes callback, logs, and applies default delay", async () => {
		lanka.setConfig({
			flags: { isMockMode: true },
		});

		const callback = vi.fn(async () => "mocked");
		const handler = createLankaMockHandler(callback, identityExtractor, "MyAction");

		expect(handler).toBeTypeOf("function");

		const result = await handler?.();

		expect(result).toBe("mocked");
		expect(callback).toHaveBeenCalledOnce();
		expect(sleep).toHaveBeenCalledWith(300);
		expect(lankaLogger.printGatewayLog).toHaveBeenCalledWith("MOCK: MyAction");
	});

	it("skips delay when delay is 0", async () => {
		lanka.setConfig({
			flags: { isMockMode: true },
		});

		const callback = vi.fn(async () => "fast");
		const handler = createLankaMockHandler(callback, identityExtractor, "FastAction", 0);

		await handler?.();

		expect(callback).toHaveBeenCalledOnce();
		expect(sleep).not.toHaveBeenCalled();
		expect(lankaLogger.printGatewayLog).toHaveBeenCalledWith("MOCK: FastAction");
	});

	it("uses fallback action name when not provided", async () => {
		lanka.setConfig({
			flags: { isMockMode: true },
		});

		const callback = vi.fn(async () => "ok");
		const handler = createLankaMockHandler(callback, identityExtractor);

		await handler?.();

		expect(lankaLogger.printGatewayLog).toHaveBeenCalled();
		const [message] = (lankaLogger.printGatewayLog as Mock).mock.calls[0];
		expect(message).toMatch(/^MOCK: /);
	});

	it("propagates callback errors after delay", async () => {
		lanka.setConfig({
			flags: { isMockMode: true },
		});

		const error = new Error("boom");

		const callback = vi.fn().mockRejectedValue(error);

		const handler = createLankaMockHandler(callback, identityExtractor, "FailAction", 50);

		await expect(handler?.()).rejects.toThrow("boom");
		expect(sleep).toHaveBeenCalledWith(50);
		expect(lankaLogger.printGatewayLog).toHaveBeenCalledWith("MOCK: FailAction");
	});

	it("stress: repeated mock handler calls (timing)", async () => {
		lanka.setConfig({
			flags: { isMockMode: true },
		});

		const callback = vi.fn(async () => "ok");
		const handler = createLankaMockHandler(callback, identityExtractor, "StressAction", 0);
		const iterations = 200;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		for (let i = 0; i < iterations; i += 1) {
			await handler?.();
		}
		const durationMs = now() - start;

		console.info(`MockHandler stress duration: ${durationMs.toFixed(2)}ms`);
		expect(callback).toHaveBeenCalledTimes(iterations);
	});
});
