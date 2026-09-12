import type { IPlaygroundProtocolFrame } from "../_interfaces/IPlaygroundProtocolFrame";

/**
 * One frame of the partner's protocol, read from an unknown value.
 *
 * ## This is what composition looks like without combinators
 *
 * `createLankaSchema` has no `object()`, no `array()`, no `optional` — and will
 * not grow them, because six schema libraries already exist and a seventh
 * written here would be the wrong people's. What it has instead is the thing
 * every language already provides: a function.
 *
 * So a shape used twice is a function used twice. `playgroundProtocolSchema`
 * reads one frame with it; `playgroundBatchSchema` reads a list of them, passing
 * a different path prefix so each failure still addresses its own element. That
 * is `array(frame)` spelled in JavaScript, and it costs one parameter.
 *
 * The moment this stops being pleasant — a union, a recursive shape, an optional
 * field in five places — is the moment to install one of the six packages. The
 * guide says so, and this file is the honest picture of what you have until then.
 */
export const readPlaygroundFrame = (
	data: unknown,
	issue: (message: string, path?: readonly (string | number)[]) => void,
	at: readonly (string | number)[] = [],
): IPlaygroundProtocolFrame => {
	if (typeof data !== "object" || data === null) {
		issue("a frame is an object", at);
		return { kind: "ping", sequence: 0, sentAt: new Date(0) };
	}

	const frame = data as Record<string, unknown>;

	if (frame.kind !== "ping" && frame.kind !== "pong") {
		issue('must be "ping" or "pong"', [...at, "kind"]);
	}

	if (typeof frame.seq !== "number" || !Number.isInteger(frame.seq) || frame.seq < 0) {
		issue("must be a whole number, zero or more", [...at, "seq"]);
	}

	// The rule that made a library the wrong tool: the protocol sends seconds as
	// a string, and a frame older than the epoch is a clock that is wrong rather
	// than a frame that is late.
	const seconds = Number(frame.at);
	if (typeof frame.at !== "string" || Number.isNaN(seconds) || seconds <= 0) {
		issue("must be seconds since the epoch, as a string", [...at, "at"]);
	}

	return {
		kind: frame.kind as "ping" | "pong",
		sequence: frame.seq as number,
		sentAt: new Date(seconds * 1000),
	};
};
