import { lankaLogger } from "lanka/logger";
import type { ILankaLoggerSink, TLankaConsoleLevel, TLankaLogMessage } from "lanka/logger";

/** One line the framework or the application wrote. */
export interface ILankaRecordedLogLine {
	at: number;
	/** `GW`, `SC`, `VM`, `UI`, `BT`, or whatever a custom printer declared. */
	layer: string;
	level: TLankaConsoleLevel;
	message: TLankaLogMessage;
	args: readonly unknown[];
}

export interface ILankaLogRecorderConfig {
	/**
	 * What happens to console output while the recorder runs. `"keep"` by
	 * default; `"silence"` leaves the recorder as the only sink and restores the
	 * console on `stop()`.
	 *
	 * A union rather than a flag: "should the console stay" is a question that
	 * can grow a third answer, and a boolean parameter cannot.
	 */
	console?: "keep" | "silence";
	/** Clock, so a test can move time. */
	clock?: () => number;
}

export interface ILankaLogRecorder {
	/** Every line written since the recorder started. */
	readonly lines: readonly ILankaRecordedLogLine[];
	/** The lines of one level. */
	readonly of: (level: TLankaConsoleLevel) => readonly ILankaRecordedLogLine[];
	/** Whether any line's message contains this text. */
	readonly contains: (text: string) => boolean;
	/** Forget everything recorded so far. The recorder keeps listening. */
	readonly clear: () => void;
	/** Stop listening and put the log back the way it was found. */
	readonly stop: () => void;
}

/** The flags every built-in printer is gated by. */
const LAYER_FLAGS = ["GATEWAY", "SCENARIO", "VIEWMODEL", "VIEW", "BOOTSTRAP"] as const;

/**
 * The lines the framework wrote, so a test can assert on the decision rather
 * than on the formatting.
 *
 * ## Why not a `console` spy
 *
 * Spying on `console.log` pins how the logger FORMATS — badges, colours, the
 * order of the arguments — onto a test that meant to assert the framework
 * warned about something. The formatting then cannot be changed without a red
 * suite in packages that never mentioned it.
 *
 * ## It turns the log ON, and that is deliberate
 *
 * Logging is off by default under test, so a recorder that only added a sink
 * would answer an empty array and the test would pass having proved nothing —
 * the exact failure `skills/testing/SKILL.md` §1 is about. The recorder owns the
 * log for its lifetime and `stop()` returns every flag to its environment value.
 */
export const createLankaLogRecorder = (config: ILankaLogRecorderConfig = {}): ILankaLogRecorder => {
	const clock = config.clock ?? (() => Date.now());
	const lines: ILankaRecordedLogLine[] = [];

	const sink: ILankaLoggerSink = {
		emit: (entry) => {
			lines.push({
				at: clock(),
				layer: entry.layer,
				level: entry.level,
				message: entry.message,
				args: entry.args,
			});
		},
	};

	if (config.console === "silence") lankaLogger.silent();
	lankaLogger.addSink(sink);
	lankaLogger.setEnabled(true);
	for (const flag of LAYER_FLAGS) lankaLogger.setFlag(flag, true);

	return {
		lines,
		of: (level) => lines.filter((line) => line.level === level),
		contains: (text) => lines.some((line) => asText(line.message).includes(text)),
		clear: () => {
			lines.length = 0;
		},
		stop: () => {
			lankaLogger.removeSink(sink);
			lankaLogger.unsetFlag("ENABLED");
			for (const flag of LAYER_FLAGS) lankaLogger.unsetFlag(flag);
			if (config.console === "silence") lankaLogger.resetSinks();
		},
	};
};

/**
 * A message as text, whatever it was.
 *
 * `TLankaLogMessage` admits an object and a function is one, so `String(...)` on
 * its own answers `[object Object]` for the case a test most wants to match.
 */
const asText = (message: TLankaLogMessage): string => {
	if (typeof message === "string") return message;
	if (message === null || message === undefined) return String(message);
	if (typeof message === "object") return JSON.stringify(message) ?? String(message);

	return String(message);
};
