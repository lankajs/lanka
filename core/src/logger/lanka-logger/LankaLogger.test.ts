import { beforeEach, describe, expect, it, vi } from "vitest";
import { lankaLogger } from "./LankaLogger";
import { createLanka } from "../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "../../bootstrap/_factories/create-lanka/createLanka";

describe("LankaLogger", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		resetActiveLanka();
		lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		// Baseline: not production, and the log is silent.
		lanka.setConfig({
			flags: {
				isProduction: false,
				loggerEnabled: false,
				loggerGateway: false,
			},
		});
	});

	it("emits logs to custom sink when enabled and flag is true", () => {
		lanka.setConfig({
			flags: {
				isProduction: false,
				loggerEnabled: true,
				loggerGateway: true,
			},
		});

		const messages: Array<Record<string, unknown>> = [];
		const sink = {
			emit: (payload: Record<string, unknown>) => {
				messages.push(payload);
			},
		};

		lankaLogger.resetSinks();
		lankaLogger.addSink(sink);
		lankaLogger.setEnabled(true);
		lankaLogger.setFlag("GATEWAY", true);

		lankaLogger.printGatewayLog("Hello", 1, 2);

		expect(messages).toHaveLength(1);
		expect(messages[0].layer).toBe("GW");
		expect(messages[0].level).toBe("log");
		expect(messages[0].message).toBe("Hello");
		expect(messages[0].args).toEqual([1, 2]);
	});

	it("silent removes sinks and resetSinks restores logging", () => {
		lanka.setConfig({
			flags: {
				isProduction: false,
				loggerEnabled: true,
				loggerGateway: true,
			},
		});

		const messages: Array<Record<string, unknown>> = [];
		const sink = {
			emit: (payload: Record<string, unknown>) => {
				messages.push(payload);
			},
		};

		lankaLogger.resetSinks();
		lankaLogger.addSink(sink);
		lankaLogger.setEnabled(true);
		lankaLogger.setFlag("GATEWAY", true);

		lankaLogger.silent();
		lankaLogger.printGatewayLog("Muted");
		expect(messages).toHaveLength(0);

		lankaLogger.resetSinks();
		lankaLogger.addSink(sink);
		lankaLogger.printGatewayLog("Back");
		expect(messages).toHaveLength(1);
	});

	it("registerPrinter and updatePrinter control emitted payload", () => {
		lanka.setConfig({
			flags: {
				isProduction: false,
				loggerEnabled: true,
			},
		});

		const messages: Array<Record<string, unknown>> = [];
		const sink = {
			emit: (payload: Record<string, unknown>) => {
				messages.push(payload);
			},
		};

		lankaLogger.resetSinks();
		lankaLogger.addSink(sink);
		lankaLogger.setEnabled(true);
		lankaLogger.setFlag("TEST", true);

		const printCustom = lankaLogger.registerPrinter({
			key: "printCustomTest",
			layer: "CT",
			level: "warn",
			flag: "TEST",
			color: "#111111",
		});

		printCustom("Before");
		expect(messages[messages.length - 1].layer).toBe("CT");
		expect(messages[messages.length - 1].level).toBe("warn");

		lankaLogger.updatePrinter("printCustomTest", {
			level: "error",
			layer: "CX",
		});

		printCustom("After");
		expect(messages[messages.length - 1].layer).toBe("CX");
		expect(messages[messages.length - 1].level).toBe("error");
	});

	it("getPrinter returns noop for unknown key and listPrinters includes built-ins", () => {
		const messages: Array<Record<string, unknown>> = [];
		const sink = {
			emit: (payload: Record<string, unknown>) => {
				messages.push(payload);
			},
		};

		lankaLogger.resetSinks();
		lankaLogger.addSink(sink);
		lankaLogger.setEnabled(true);
		lankaLogger.setFlag("GATEWAY", true);

		const noopPrinter = lankaLogger.getPrinter("missing");
		noopPrinter("ShouldNotEmit");
		expect(messages).toHaveLength(0);

		expect(lankaLogger.listPrinters()).toEqual(
			expect.arrayContaining([
				"printGatewayLog",
				"printScenarioLog",
				"printViewModelLog",
				"printViewLog",
				"printBootstrapLog",
			]),
		);
	});

	it("does not emit when globally disabled even if flag is true", () => {
		const messages: Array<Record<string, unknown>> = [];
		const sink = {
			emit: (payload: Record<string, unknown>) => {
				messages.push(payload);
			},
		};

		lankaLogger.resetSinks();
		lankaLogger.addSink(sink);
		lankaLogger.setEnabled(false);
		lankaLogger.setFlag("GATEWAY", true);

		lankaLogger.printGatewayLog("Silent");
		expect(messages).toHaveLength(0);
	});

	it("unsetFlag disables flag-based logging", () => {
		if (import.meta.env.PROD) {
			expect(lankaLogger.listPrinters()).toEqual([]);
			return;
		}

		const messages: Array<Record<string, unknown>> = [];
		const sink = {
			emit: (payload: Record<string, unknown>) => {
				messages.push(payload);
			},
		};

		lankaLogger.resetSinks();
		lankaLogger.addSink(sink);
		lankaLogger.setEnabled(true);
		lankaLogger.setFlag("GATEWAY", true);

		lankaLogger.printGatewayLog("Before");
		expect(messages).toHaveLength(1);

		lankaLogger.setFlag("GATEWAY", false);
		lankaLogger.printGatewayLog("After");

		expect(messages).toHaveLength(1);
	});
});

describe("updatePrinter with fields left undefined", () => {
	// Two of five fields were defended and three were not, which is the shape a
	// half-noticed defect leaves behind. A patch says what to CHANGE: a field it
	// did not mention, or mentioned as `undefined`, keeps its value.
	it("keeps every field the patch did not name", () => {
		const seen: { layer: string; level: string; color?: string }[] = [];

		lankaLogger.resetSinks();
		lankaLogger.addSink({
			emit: (entry) =>
				seen.push({ layer: entry.layer, level: entry.level, color: entry.color }),
		});
		lankaLogger.setEnabled(true);
		lankaLogger.setFlag("PATCHED", true);

		const print = lankaLogger.registerPrinter({
			key: "printPatchedLog",
			layer: "PATCHED",
			color: "#123456",
			level: "warn",
			flag: "PATCHED",
			enabled: true,
		});

		lankaLogger.updatePrinter("printPatchedLog", {
			layer: undefined,
			color: undefined,
			level: undefined,
			flag: undefined,
			enabled: undefined,
		});

		print("still here");

		expect(seen).toEqual([{ layer: "PATCHED", level: "warn", color: "#123456" }]);
	});

	it("changes only what the patch names", () => {
		const seen: { layer: string; level: string }[] = [];

		lankaLogger.resetSinks();
		lankaLogger.addSink({
			emit: (entry) => seen.push({ layer: entry.layer, level: entry.level }),
		});
		lankaLogger.setEnabled(true);

		const print = lankaLogger.registerPrinter({
			key: "printNarrowLog",
			layer: "BEFORE",
			level: "warn",
			enabled: true,
		});

		lankaLogger.updatePrinter("printNarrowLog", { layer: "AFTER" });
		print("moved");

		expect(seen).toEqual([{ layer: "AFTER", level: "warn" }]);
	});
});
