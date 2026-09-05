import { describe, expect, it } from "vitest";
import { grpcFailure } from "./grpcFailure";

/**
 * Sixteen codes into five kinds.
 *
 * A mapping rather than a lookup: each kind means something different to the
 * interface, and getting one wrong shows a user an error for leaving a screen or
 * offers a retry of something that will never work.
 */
describe("grpcFailure", () => {
	it("keeps a cancelled call silent", () => {
		expect(grpcFailure(1, "").kind).toBe("aborted");
	});

	it("shows an expired deadline, and invites another try", () => {
		expect(grpcFailure(4, "").kind).toBe("timeout");
	});

	it("treats an unreachable server as a network failure", () => {
		expect(grpcFailure(14, "").kind).toBe("network");
	});

	it("treats a broken or missing handler as neither the user's doing nor a refusal", () => {
		expect(grpcFailure(12, "").kind).toBe("http");
		expect(grpcFailure(13, "").kind).toBe("http");
	});

	it("treats every deliberate refusal as domain", () => {
		for (const status of [3, 5, 6, 7, 8, 9, 10, 11, 15, 16]) {
			expect(grpcFailure(status, "").kind).toBe("domain");
		}
	});

	it("carries the status NAME as the code", () => {
		// `error.code === "PERMISSION_DENIED"` is a line somebody can read;
		// `error.code === "7"` is a line somebody has to look up.
		expect(grpcFailure(7, "").code).toBe("PERMISSION_DENIED");
	});

	it("names a status it does not know rather than dropping it", () => {
		expect(grpcFailure(42, "").code).toBe("GRPC_42");
	});

	it("says something when the server said nothing", () => {
		// An empty message would reach an error boundary as a blank line.
		expect(grpcFailure(9, "").message).toContain("9");
	});

	it("keeps the server's own words when there are any", () => {
		expect(grpcFailure(9, "Already completed").message).toBe("Already completed");
	});
});
