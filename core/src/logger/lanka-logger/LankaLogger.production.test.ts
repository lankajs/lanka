import { beforeEach, describe, expect, it, vi } from "vitest";
import { lankaLogger } from "./LankaLogger";
import { createLanka } from "../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "../../bootstrap/_factories/create-lanka/createLanka";

/**
 * In production every lever on the logger is a no-op.
 *
 * ## Why this file exists
 *
 * The guard is written fourteen times — once per public method — and not one of
 * those fourteen lines was executed by any test. That is the wrong half to leave
 * uncovered: a log line on a public host is a description of the API to anyone
 * with a devtools tab, and this framework's consumers say so in their own
 * configs.
 *
 * ## Why every case OBSERVES AFTER LEAVING production
 *
 * The first draft of this file asserted the obvious thing — call a printer in
 * production, expect the sink to stay empty — and it proved almost nothing. The
 * silence of the output path is enforced by FOUR overlapping guards (`emit`,
 * `isPrinterEnabled`, `isEnabled`, `isFlagEnabled`), so removing any one of them
 * left the suite green: measured, one at a time, on this very file.
 *
 * What each mutator actually promises is narrower and stronger: the STATE does
 * not change. So each case below configures in production, then drops
 * `isProduction` and looks at what the logger does — the mutation either
 * survived being ignored or it did not. Removing a single guard turns exactly
 * one case red, which is the only version of this file worth having.
 */
describe("lankaLogger in production", () => {
	let lanka: ILankaInstance;
	let emitted: Array<Record<string, unknown>>;
	const sink = { emit: (payload: Record<string, unknown>) => void emitted.push(payload) };

	const setFlags = (flags: Record<string, boolean>): void => {
		lanka.setConfig({ flags });
	};

	/** Production, with every environment flag that could make it talk turned on. */
	const enterProduction = (): void => {
		setFlags({ isProduction: true, loggerEnabled: true, loggerGateway: true });
	};

	/** The same flags, minus production — the vantage point every case observes from. */
	const leaveProduction = (): void => {
		setFlags({ isProduction: false, loggerEnabled: true, loggerGateway: true });
	};

	beforeEach(() => {
		vi.clearAllMocks();
		emitted = [];
		resetActiveLanka();
		lanka = createLanka({ host: lankaTestHost });
		lanka.activate();

		// Development first, so the fixture below is built by calls that are NOT
		// no-ops; production is entered per case.
		setFlags({ isProduction: false, loggerEnabled: true, loggerGateway: true });
		lankaLogger.resetSinks();
		lankaLogger.silent();
		lankaLogger.addSink(sink);
		lankaLogger.setStyle("badge");
		lankaLogger.unsetFlag("GATEWAY");
	});

	// ── The output path, as a property rather than as a guard ────────────────

	it("emits nothing while production is on, with every flag on and a sink attached", () => {
		enterProduction();

		lankaLogger.printGatewayLog("a gateway said something");
		lankaLogger.printScenarioLog("so did a scenario");
		lankaLogger.printViewModelLog("and a view model");
		lankaLogger.printViewLog("and a view");
		lankaLogger.printBootstrapLog("and bootstrap");

		expect(emitted).toEqual([]);
	});

	it("never calls a message factory — the work is not done, not merely dropped", () => {
		enterProduction();
		const factory = vi.fn(() => "expensive");

		lankaLogger.printGatewayLog(factory);

		// The point of passing a function is that a silenced logger costs nothing.
		expect(factory).not.toHaveBeenCalled();
	});

	// ── Each mutator, pinned by the state it must not change ─────────────────

	it("setEnabled(true) leaves no runtime override behind", () => {
		enterProduction();
		lankaLogger.setEnabled(true);

		// `loggerEnabled: false` now decides. An override that had been recorded
		// would outrank it and the log would speak.
		setFlags({ isProduction: false, loggerEnabled: false, loggerGateway: true });
		lankaLogger.printGatewayLog("should not appear");

		expect(emitted).toEqual([]);
	});

	it("setStyle leaves the style as it was", () => {
		enterProduction();
		lankaLogger.setStyle("plain");

		leaveProduction();
		lankaLogger.printGatewayLog("styled");

		expect(emitted[0]?.style).toBe("badge");
	});

	it("setFlag leaves no runtime flag behind", () => {
		enterProduction();
		lankaLogger.setFlag("GATEWAY", false);

		leaveProduction();

		// A recorded `false` would outrank `loggerGateway: true`.
		expect(lankaLogger.isFlagEnabled("GATEWAY")).toBe(true);
	});

	it("unsetFlag leaves an existing runtime flag in place", () => {
		lankaLogger.setFlag("GATEWAY", false);
		enterProduction();
		lankaLogger.unsetFlag("GATEWAY");

		leaveProduction();

		// The `false` set in development must have survived.
		expect(lankaLogger.isFlagEnabled("GATEWAY")).toBe(false);
	});

	it("addSink attaches nothing", () => {
		enterProduction();
		const late: unknown[] = [];
		lankaLogger.addSink({ emit: (payload: unknown) => void late.push(payload) });

		leaveProduction();
		lankaLogger.printGatewayLog("for the original sink only");

		expect(late).toEqual([]);
		expect(emitted).toHaveLength(1);
	});

	it("removeSink detaches nothing", () => {
		enterProduction();
		lankaLogger.removeSink(sink);

		leaveProduction();
		lankaLogger.printGatewayLog("still reaches it");

		expect(emitted).toHaveLength(1);
	});

	it("resetSinks does not drop a sink the application added", () => {
		enterProduction();
		lankaLogger.resetSinks();

		leaveProduction();
		lankaLogger.printGatewayLog("still reaches it");

		expect(emitted).toHaveLength(1);
	});

	it("silent() does not clear the sinks", () => {
		enterProduction();
		lankaLogger.silent();

		leaveProduction();
		lankaLogger.printGatewayLog("still reaches it");

		expect(emitted).toHaveLength(1);
	});

	it("registerPrinter registers nothing", () => {
		enterProduction();
		const print = lankaLogger.registerPrinter({ key: "printProdLog", layer: "PD" });

		print("through the returned callable");
		leaveProduction();

		expect(lankaLogger.listPrinters()).not.toContain("printProdLog");
		expect(emitted).toEqual([]);
	});

	it("updatePrinter changes nothing", () => {
		lankaLogger.registerPrinter({ key: "printOwnLog", layer: "AA" });
		enterProduction();
		lankaLogger.updatePrinter("printOwnLog", { layer: "BB" });

		leaveProduction();
		lankaLogger.getPrinter("printOwnLog")("layered");

		expect(emitted[0]?.layer).toBe("AA");
	});

	// ── The readers, pinned by their own return ──────────────────────────────

	it("isFlagEnabled answers false for a flag the environment says is true", () => {
		enterProduction();

		expect(lankaLogger.isFlagEnabled("GATEWAY")).toBe(false);
	});

	it("listPrinters answers empty, not the five built-ins", () => {
		enterProduction();

		expect(lankaLogger.listPrinters()).toEqual([]);
	});

	it("getPrinter hands back a callable that stays silent after production ends", () => {
		enterProduction();
		const captured = lankaLogger.getPrinter("printGatewayLog");

		// The noop was taken in production; leaving it must not bring it to life.
		leaveProduction();
		captured("through a callable taken in production");

		expect(emitted).toEqual([]);
	});
});
