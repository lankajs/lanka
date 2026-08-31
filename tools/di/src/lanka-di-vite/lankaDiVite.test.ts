import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiVite } from "./lankaDiVite";

const roots: string[] = [];

const makeRoot = (): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-plugin-"));
	roots.push(root);
	return root;
};

afterEach(() => {
	while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

/**
 * A stand-in for the bundler's plugin context.
 *
 * Only `warn` and `error` are reached, and `error` THROWS in the bundler: a
 * plugin that reported a problem and let the build continue is exactly the
 * failure this plugin exists to prevent, so the double throws too.
 */
const makeContext = () => {
	const warn = vi.fn();
	const error = vi.fn((message: string) => {
		throw new Error(message);
	});
	return { warn, error };
};

const runConfig = (plugin: any, root: string) => plugin.config({ root }, { command: "build" });
const runBuildStart = (plugin: any, ctx: ReturnType<typeof makeContext>) =>
	plugin.buildStart.call(ctx);

describe("lankaDiVite — the alias", () => {
	it("points @lanka_di at the consumer root, so the app never hand-wires it", () => {
		const root = makeRoot();

		const config = runConfig(lankaDiVite(), root) as {
			resolve: { alias: Record<string, string> };
		};

		expect(config.resolve.alias[lankaDiContract.alias]).toBe(
			`${root.replace(/\\/g, "/")}/${lankaDiContract.dirname}`,
		);
	});

	it("normalises Windows separators, because a backslash in a vite alias never matches", () => {
		const alias = (
			runConfig(lankaDiVite({ root: "C:\\projects\\app" }), "ignored") as {
				resolve: { alias: Record<string, string> };
			}
		).resolve.alias[lankaDiContract.alias];

		expect(alias).toBe(`C:/projects/app/${lankaDiContract.dirname}`);
		expect(alias).not.toContain("\\");
	});

	it("lets an explicit root override what vite resolved", () => {
		const mine = makeRoot();

		const config = runConfig(lankaDiVite({ root: mine }), "C:/somewhere/else") as {
			resolve: { alias: Record<string, string> };
		};

		expect(config.resolve.alias[lankaDiContract.alias]).toContain(mine.replace(/\\/g, "/"));
	});
});

describe("lankaDiVite — buildStart", () => {
	it("scaffolds a fresh consumer and warns, so the files get committed", () => {
		const root = makeRoot();
		const plugin = lankaDiVite({ root });
		const ctx = makeContext();

		runBuildStart(plugin, ctx);

		expect(existsSync(join(root, lankaDiContract.dirname, "Host.ts"))).toBe(true);
		expect(ctx.error).not.toHaveBeenCalled();
		const warned = ctx.warn.mock.calls[0][0] as string;
		expect(warned).toContain(`${lankaDiContract.dirname}/Host.ts`);
		expect(warned).toContain("Commit these");
	});

	it("says nothing at all on a healthy project", () => {
		const root = makeRoot();
		runBuildStart(lankaDiVite({ root }), makeContext());
		const ctx = makeContext();

		runBuildStart(lankaDiVite({ root }), ctx);

		expect(ctx.warn).not.toHaveBeenCalled();
		expect(ctx.error).not.toHaveBeenCalled();
	});

	it("fails the build when a barrel stopped exporting what lanka calls by name", () => {
		const root = makeRoot();
		runBuildStart(lankaDiVite({ root }), makeContext());
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const other = {};\n",
			"utf8",
		);
		const ctx = makeContext();

		// The whole point of the plugin: the BUILD fails naming the file and the
		// symbol, instead of an `undefined` surfacing inside the locator three
		// layers away at runtime.
		expect(() => runBuildStart(lankaDiVite({ root }), ctx)).toThrow(
			/does not export `lankaHost`/,
		);
	});

	it("refuses to generate anything when scaffolding is off, as in CI", () => {
		const root = makeRoot();
		const ctx = makeContext();

		expect(() => runBuildStart(lankaDiVite({ root, scaffold: false }), ctx)).toThrow(
			new RegExp(`${lankaDiContract.dirname}/ is missing`),
		);
		expect(existsSync(join(root, lankaDiContract.dirname))).toBe(false);
		expect(ctx.warn).not.toHaveBeenCalled();
	});

	it("reports every problem at once rather than one per build", () => {
		const root = makeRoot();
		runBuildStart(lankaDiVite({ root }), makeContext());
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const other = {};\n",
			"utf8",
		);
		writeFileSync(join(root, "tsconfig.json"), `{ "include": ["src/**/*"] }`, "utf8");
		const ctx = makeContext();

		let message = "";
		try {
			runBuildStart(lankaDiVite({ root }), ctx);
		} catch (error) {
			message = (error as Error).message;
		}

		// Three separate causes, one build. Fixing them one build at a time is how a
		// five-minute setup becomes an afternoon.
		expect(message).toContain("does not export `lankaHost`");
		expect(message).toContain(`"${lankaDiContract.alias}/*"`);
		expect(message).toContain(`"${lankaDiContract.dirname}/**/*"`);
	});
});
