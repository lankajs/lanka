/**
 * Pins `llms.mjs`: the index is a function of the repository's CONTENT, never of
 * the order a file system lists it in.
 *
 * The defect this exists for: `llms.txt` listed `skills/` and `api/` in whatever
 * order `readdirSync` returned them. NTFS returns names sorted, so every local
 * `check:drift` passed; ext4 does not, so CI's regenerated index differed from
 * the committed one and `check:drift` failed on every push from 2026-09-06 —
 * while every local run said the two agreed.
 *
 * The file system is replaced by one that lists each directory in REVERSE, the
 * way a file system that owes no order may, and the index must not move.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const listing = vi.hoisted(() => ({ reversed: false }));

vi.mock("node:fs", async (importOriginal) => {
	const fs = await importOriginal();
	const readdirSync = (...args) => {
		const names = fs.readdirSync(...args);
		return listing.reversed ? [...names].reverse() : names;
	};
	return { ...fs, default: { ...fs, readdirSync }, readdirSync };
});

const { renderLlmsIndex } = await import("./llms.mjs");

afterEach(() => {
	listing.reversed = false;
});

describe("renderLlmsIndex", () => {
	it("writes the same index whatever order the file system lists directories in", () => {
		const sorted = renderLlmsIndex();
		listing.reversed = true;

		expect(renderLlmsIndex()).toBe(sorted);
	});
});
