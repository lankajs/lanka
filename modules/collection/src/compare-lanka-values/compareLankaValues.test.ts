import { describe, expect, it } from "vitest";
import { compareLankaValues } from "./compareLankaValues";

describe("ordering two cell values", () => {
	it("puts an empty cell first, because that is the row somebody is looking for", () => {
		expect(compareLankaValues(null, "a")).toBeLessThan(0);
		expect(compareLankaValues("a", undefined)).toBeGreaterThan(0);
	});

	it("compares numbers as numbers", () => {
		// As text, 9 sorts after 10 — and it looks like a bug in the server.
		expect(compareLankaValues(9, 10)).toBeLessThan(0);
	});

	it("compares dates as dates", () => {
		expect(compareLankaValues(new Date("2026-04-19"), new Date("2026-05-02"))).toBeLessThan(0);
	});

	it("compares text without caring about case", () => {
		expect(compareLankaValues("apple", "Banana")).toBeLessThan(0);
	});

	it("sorts an accented letter beside its plain one, not after Z", () => {
		expect(compareLankaValues("Ärger", "Berlin")).toBeLessThan(0);
	});

	it("says nothing about two equal values", () => {
		expect(compareLankaValues("a", "a")).toBe(0);
	});
});
