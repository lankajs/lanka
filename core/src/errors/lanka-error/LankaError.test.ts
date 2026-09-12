import { describe, expect, it } from "vitest";
import { LankaError } from "./LankaError";

/**
 * A failure you can branch on.
 *
 * Six kinds, because each demands something DIFFERENT of the interface — the
 * only reason to distinguish them at all:
 *
 * - `network` — offer a retry;
 * - `timeout` — the same, phrased differently;
 * - `aborted` — show nothing: the user already left;
 * - `http` — depends on the status;
 * - `schema` — report a break rather than blame the user;
 * - `domain` — show what the server said.
 *
 * What is pinned below is not "the class exists" but that a decision can be made
 * from the kind, and that the kind is not lost on the way.
 */

describe("LankaError", () => {
	it("carries a kind you can branch on", () => {
		const error = new LankaError({ kind: "network", message: "no network" });

		expect(error.kind).toBe("network");
		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe("no network");
	});

	// A form needs an ADDRESS per message, and `issues` flattens the address into
	// the text. `fields` keeps the path in segments — `["items", 1, "qty"]` — so
	// a form library joins it its own way, and `code` lets an application
	// translate rather than show what the server said.
	it("carries field errors as path segments, beside the flat issue list", () => {
		const fields = [{ path: ["items", 1, "qty"], message: "only 2 left", code: "STOCK" }];
		const error = new LankaError({
			kind: "http",
			message: "unprocessable",
			status: 422,
			issues: ["items.1.qty: only 2 left"],
			fields,
		});

		expect(error.fields).toBe(fields);
		expect(error.errors).toEqual(["items.1.qty: only 2 left"]);
	});

	it("`LankaError.is` recognises it among foreign errors", () => {
		expect(LankaError.is(new LankaError({ kind: "timeout", message: "too slow" }))).toBe(true);
		expect(LankaError.is(new Error("someone else's"))).toBe(false);
		expect(LankaError.is(null)).toBe(false);
		expect(LankaError.is({ kind: "network" })).toBe(false);
	});

	it("carries a status for http and a code for domain", () => {
		const http = new LankaError({ kind: "http", message: "conflict", status: 409 });
		const domain = new LankaError({
			kind: "domain",
			message: "slot taken",
			status: 409,
			code: "GAP_ALREADY_TAKEN",
		});

		expect(http.status).toBe(409);
		expect(http.code).toBeUndefined();
		expect(domain.code).toBe("GAP_ALREADY_TAKEN");
	});

	it("carries field paths for schema", () => {
		const error = new LankaError({
			kind: "schema",
			message: "response in the wrong shape",
			issues: ["items.0.id: expected number", "items.0.name: required"],
		});

		expect(error.issues).toEqual(["items.0.id: expected number", "items.0.name: required"]);
	});

	it("keeps the original cause when wrapping", () => {
		const cause = new TypeError("fetch failed");
		const error = new LankaError({ kind: "network", message: "no network", cause });

		expect(error.cause).toBe(cause);
	});

	/**
	 * Compatibility: while `ILankaApiError` is read the old way, `LankaError` must
	 * answer the same questions, or the transition requires rewriting every
	 * consumer at once.
	 */
	it("reads as an `ILankaApiError`", () => {
		const error = new LankaError({
			kind: "http",
			message: "not found",
			status: 404,
			issues: ["not found"],
		});

		expect(error.status).toBe(404);
		expect(error.errors).toEqual(["not found"]);
	});

	it("`aborted` differs from `timeout`, though both mean an unfinished request", () => {
		const aborted = new LankaError({ kind: "aborted", message: "cancelled" });
		const timeout = new LankaError({ kind: "timeout", message: "no response in time" });

		// Not cosmetic: a cancelled request must not be shown — the user left — and
		// a timed-out one must be.
		expect(aborted.kind).not.toBe(timeout.kind);
		expect(aborted.isSilent).toBe(true);
		expect(timeout.isSilent).toBe(false);
	});
});
