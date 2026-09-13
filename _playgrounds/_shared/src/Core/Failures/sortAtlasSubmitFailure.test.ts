import { LankaError } from "lanka/errors";
import { describe, expect, it, vi } from "vitest";
import { sortAtlasSubmitFailure } from "./sortAtlasSubmitFailure";

describe("sortAtlasSubmitFailure", () => {
	it("rethrows anything that is not ours", () => {
		expect(() => sortAtlasSubmitFailure(new TypeError("bug"), vi.fn())).toThrow(TypeError);
	});

	it("says nothing at all about a cancelled submit", () => {
		const toScreen = vi.fn();

		const outcome = sortAtlasSubmitFailure(
			new LankaError({ kind: "aborted", message: "aborted" }),
			toScreen,
		);

		expect(outcome).toEqual({ ok: false, fields: [] });
		expect(toScreen).not.toHaveBeenCalled();
	});

	it("sends a failure that has an address to the form, and not to the screen", () => {
		// A 422 belongs under the inputs. Showing it in a banner as well would tell
		// somebody twice and still not say which field.
		const toScreen = vi.fn();
		const failure = new LankaError({
			kind: "http",
			message: "this mission cannot be saved",
			status: 422,
			fields: [{ path: ["title"], message: "a title is at least 4 characters" }],
		});

		const outcome = sortAtlasSubmitFailure(failure, toScreen);

		expect(outcome).toEqual({
			ok: false,
			fields: [{ path: ["title"], message: "a title is at least 4 characters" }],
		});
		expect(toScreen).not.toHaveBeenCalled();
	});

	it("keeps an address in segments rather than joining it", () => {
		// One form library writes `items.1.qty`, another `items[1].qty`. A joined
		// string cannot be taken apart again: a message may contain a colon and a
		// key may contain a dot.
		const failure = new LankaError({
			kind: "http",
			message: "no",
			status: 422,
			fields: [{ path: ["items", 1, "qty"], message: "only 2 left" }],
		});

		const outcome = sortAtlasSubmitFailure(failure, vi.fn());

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.fields[0].path).toEqual(["items", 1, "qty"]);
	});

	it("gives a deliberate refusal to the form's root rather than to the screen", () => {
		const toScreen = vi.fn();
		const failure = new LankaError({ kind: "domain", message: "that mission is already done" });

		const outcome = sortAtlasSubmitFailure(failure, toScreen);

		expect(outcome).toEqual({
			ok: false,
			fields: [],
			message: "that mission is already done",
		});
		expect(toScreen).not.toHaveBeenCalled();
	});

	it("gives a connection failure to the screen, because no input owns the network", () => {
		const toScreen = vi.fn();

		sortAtlasSubmitFailure(
			new LankaError({ kind: "network", message: "No connection" }),
			toScreen,
		);

		expect(toScreen).toHaveBeenCalledWith("No connection");
	});
});
