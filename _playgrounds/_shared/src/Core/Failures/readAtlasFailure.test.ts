import { LankaError } from "lanka/errors";
import { describe, expect, it } from "vitest";
import { readAtlasFailure } from "./readAtlasFailure";

describe("readAtlasFailure", () => {
	it("answers the sentence a screen should show", () => {
		const failure = new LankaError({
			kind: "http",
			message: "the depot is closed",
			status: 409,
		});

		expect(readAtlasFailure(failure)).toBe("the depot is closed");
	});

	it("answers nothing for a cancelled call", () => {
		// The person who cancelled knows they did. Telling them about it is the
		// application reporting its own plumbing.
		const failure = new LankaError({ kind: "aborted", message: "aborted" });

		expect(readAtlasFailure(failure)).toBeNull();
	});

	it("rethrows anything that is not ours", () => {
		// A TypeError from a bug in a handler is not a message for a user, and
		// swallowing it into a banner is how a defect becomes "the server is down".
		expect(() => readAtlasFailure(new TypeError("cannot read x of undefined"))).toThrow(
			TypeError,
		);
	});

	it("shows a network failure, which is a thing the person can act on", () => {
		const failure = new LankaError({ kind: "network", message: "No connection" });

		expect(readAtlasFailure(failure)).toBe("No connection");
	});
});
