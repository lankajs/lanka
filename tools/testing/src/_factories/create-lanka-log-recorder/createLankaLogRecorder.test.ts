import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lankaLogger } from "lanka/logger";
import { resetLanka } from "../../resetLanka";
import { createLankaLogRecorder } from "./createLankaLogRecorder";
import type { ILankaLogRecorder } from "./createLankaLogRecorder";

/**
 * The recorder exists so a test asserts what the framework DECIDED, not how it
 * printed it. Every case below is one of those two being confused.
 */
let recorder: ILankaLogRecorder | null = null;

beforeEach(() => {
	resetLanka();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
	recorder?.stop();
	recorder = null;
});

describe("createLankaLogRecorder", () => {
	it("records a line the framework wrote", () => {
		recorder = createLankaLogRecorder();

		lankaLogger.printGatewayLog("GET /profile");

		expect(recorder.lines).toHaveLength(1);
		expect(recorder.lines[0].layer).toBe("GW");
	});

	it("turns the log on, so an empty array means nothing happened", () => {
		// Logging is off by default under test. A recorder that only added a sink
		// would answer [] and the test would pass having proved nothing — which is
		// the failure `skills/testing/SKILL.md` §1 is about.
		lankaLogger.setEnabled(false);
		recorder = createLankaLogRecorder();

		lankaLogger.printViewModelLog("state changed");

		expect(recorder.contains("state changed")).toBe(true);
	});

	it("sees every layer, not only the one the last test enabled", () => {
		recorder = createLankaLogRecorder();

		lankaLogger.printGatewayLog("gw");
		lankaLogger.printScenarioLog("sc");
		lankaLogger.printViewModelLog("vm");
		lankaLogger.printViewLog("ui");
		lankaLogger.printBootstrapLog("bt");

		expect(recorder.lines.map((line) => line.layer)).toEqual(["GW", "SC", "VM", "UI", "BT"]);
	});

	it("finds text inside a message that is not a string", () => {
		// `TLankaLogMessage` admits an object, and `String(...)` answers
		// "[object Object]" for the case a test most wants to match.
		recorder = createLankaLogRecorder();

		lankaLogger.printGatewayLog({ endpoint: "/profile" });

		expect(recorder.contains("/profile")).toBe(true);
	});

	it("matches a message that is neither a string nor an object", () => {
		// The whole union, not the two members a first draft thinks of: a number, a
		// boolean and `null` are all legal messages, and a `contains` that threw on
		// one would fail inside the assertion rather than at the line that logged.
		recorder = createLankaLogRecorder();

		lankaLogger.printGatewayLog(404);
		lankaLogger.printGatewayLog(null);

		expect(recorder.contains("404")).toBe(true);
		expect(recorder.contains("null")).toBe(true);
	});

	it("dates each line with the clock it was given", () => {
		recorder = createLankaLogRecorder({ clock: () => 42 });

		lankaLogger.printGatewayLog("GET /profile");

		expect(recorder.lines[0].at).toBe(42);
	});

	it("keeps the console by default and silences it on request", () => {
		const kept = createLankaLogRecorder();
		lankaLogger.printGatewayLog("noisy");
		expect(console.log).toHaveBeenCalled();
		kept.stop();

		vi.mocked(console.log).mockClear();
		recorder = createLankaLogRecorder({ console: "silence" });
		lankaLogger.printGatewayLog("quiet");

		expect(console.log).not.toHaveBeenCalled();
		expect(recorder.contains("quiet")).toBe(true);
	});

	it("gives the console back after silencing it", () => {
		createLankaLogRecorder({ console: "silence" }).stop();
		recorder = createLankaLogRecorder();

		lankaLogger.printGatewayLog("audible again");

		expect(console.log).toHaveBeenCalled();
	});

	it("stops recording, and leaves the log as it found it", () => {
		const stopped = createLankaLogRecorder();
		lankaLogger.printGatewayLog("first");
		stopped.stop();

		lankaLogger.printGatewayLog("second");

		expect(stopped.lines).toHaveLength(1);
		// The flags it set are gone too: a recorder that left the log switched on
		// would make the next test's console noise its fault, three files away.
		expect(lankaLogger.isFlagEnabled("GATEWAY")).toBe(false);
	});

	it("answers the lines of one level", () => {
		recorder = createLankaLogRecorder();

		lankaLogger.printGatewayLog("a line");

		expect(recorder.of("log")).toHaveLength(1);
		expect(recorder.of("error")).toHaveLength(0);
	});

	it("keeps listening after it is cleared", () => {
		recorder = createLankaLogRecorder();

		lankaLogger.printGatewayLog("first");
		recorder.clear();
		lankaLogger.printGatewayLog("second");

		expect(recorder.lines).toHaveLength(1);
		expect(recorder.contains("second")).toBe(true);
	});
});
