import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lankaDiTurbopack } from "./lankaDiTurbopack";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";

describe("lankaDiTurbopack", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "lanka-turbopack-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("answers what `next.config.js` spreads under `turbopack`", () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const config = lankaDiTurbopack({ root });

		expect(config.resolveAlias[lankaDiContract.alias]).toBe(
			`${root.replace(/\\/g, "/")}/.lanka_di`,
		);
	});

	// Turbopack has no plugin API, so the work happens while the config is being
	// read — earlier than every other adapter checks, not later.
	it("verifies at config time, before Next.js has done anything", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		lankaDiTurbopack({ root });

		expect(warn.mock.calls[0][0]).toContain("Commit these");
	});

	it("throws out of the config when a barrel lost a required export", () => {
		mkdirSync(join(root, lankaDiContract.dirname), { recursive: true });
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const nothing = 1;\n",
		);

		expect(() => lankaDiTurbopack({ root })).toThrow(/lankaHost/);
	});

	it("is quiet on a healthy project", () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		lankaDiTurbopack({ root });

		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		lankaDiTurbopack({ root });

		expect(warn).not.toHaveBeenCalled();
	});
});
