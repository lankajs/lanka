import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lankaDiEsbuild } from "./lankaDiEsbuild";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import type { ILankaEsbuildBuild } from "./lankaDiEsbuild";

/** An esbuild `build` that records instead of building. */
const fakeBuild = () => {
	const starts: (() => void)[] = [];
	const resolvers: {
		filter: RegExp;
		callback: (args: { path: string }) => { path: string } | undefined;
	}[] = [];

	const build: ILankaEsbuildBuild = {
		onStart: (callback) => starts.push(callback),
		onResolve: (options, callback) => resolvers.push({ ...options, callback }),
	};

	return { build, starts, resolvers };
};

describe("lankaDiEsbuild", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "lanka-esbuild-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("registers a start hook and a resolver", () => {
		const { build, starts, resolvers } = fakeBuild();

		lankaDiEsbuild({ root }).setup(build);

		expect(starts).toHaveLength(1);
		expect(resolvers).toHaveLength(1);
	});

	it("resolves a barrel to the file on disk", () => {
		const { build, resolvers } = fakeBuild();
		lankaDiEsbuild({ root }).setup(build);

		const resolved = resolvers[0].callback({ path: `${lankaDiContract.alias}/Gateways` });

		expect(resolved?.path).toBe(`${root.replace(/\\/g, "/")}/.lanka_di/Gateways.ts`);
	});

	// A filter of `/lanka/` would claim the framework's own imports. Anchored on
	// the alias, it claims exactly what the alias means.
	it("claims the alias and nothing that merely contains the name", () => {
		const { build, resolvers } = fakeBuild();
		lankaDiEsbuild({ root }).setup(build);

		expect(resolvers[0].filter.test("@lanka_di/Gateways")).toBe(true);
		expect(resolvers[0].filter.test("lanka/gateway")).toBe(false);
		expect(resolvers[0].filter.test("@lankajs/tool-di")).toBe(false);
	});

	it("scaffolds on the first build and says so once", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { build, starts } = fakeBuild();
		lankaDiEsbuild({ root }).setup(build);

		starts[0]();

		expect(warn.mock.calls[0][0]).toContain("Commit these");
	});

	it("fails the build when a barrel lost a required export", () => {
		mkdirSync(join(root, lankaDiContract.dirname), { recursive: true });
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const nothing = 1;\n",
		);

		const { build, starts } = fakeBuild();
		lankaDiEsbuild({ root }).setup(build);

		expect(() => starts[0]()).toThrow(/lankaHost/);
	});
});
