import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
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
const runConfigResolved = (plugin: any, root: string) => plugin.configResolved({ root });

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

	// The root is made absolute before it is normalised, so the input here is a
	// real absolute path from the platform running the suite — a hard-coded
	// `C:\\projects\\app` resolves against the working directory on linux and the
	// spec would assert a windows-only answer on a linux runner. On windows
	// `makeRoot()` returns backslashes, which is where the normalising matters;
	// on linux there is nothing to normalise and the spec says so by passing.
	it("normalises separators, because a backslash in a vite alias never matches", () => {
		const root = makeRoot();

		const alias = (
			runConfig(lankaDiVite({ root }), "ignored") as {
				resolve: { alias: Record<string, string> };
			}
		).resolve.alias[lankaDiContract.alias];

		expect(alias).toBe(`${root.replace(/\\/g, "/")}/${lankaDiContract.dirname}`);
		expect(alias).not.toContain("\\");
	});

	/*
	 * A relative root is an ordinary vite config — `root: "app"` — and vite
	 * resolves it against the working directory before using it. Passed through
	 * as written it produces a relative ALIAS, and a relative alias is not a path
	 * to vite: `app/.lanka/Gateways` is a bare specifier, looked for in
	 * `node_modules` and not found. Measured before the fix: the dev server
	 * answered 500, "Failed to resolve import @lanka_di/Singletons".
	 */
	it("makes a relative root absolute, because a relative alias is a bare specifier", () => {
		const alias = (
			runConfig(lankaDiVite({ root: "app" }), "ignored") as {
				resolve: { alias: Record<string, string> };
			}
		).resolve.alias[lankaDiContract.alias];

		expect(isAbsolute(alias)).toBe(true);
		expect(alias).toBe(`${resolve("app").replace(/\\/g, "/")}/${lankaDiContract.dirname}`);
	});

	it("lets an explicit root override what vite resolved", () => {
		const mine = makeRoot();

		const config = runConfig(lankaDiVite({ root: mine }), "C:/somewhere/else") as {
			resolve: { alias: Record<string, string> };
		};

		expect(config.resolve.alias[lankaDiContract.alias]).toContain(mine.replace(/\\/g, "/"));
	});
});

/**
 * The alias is also an instruction to vite's dependency optimizer, and the
 * expensive half of this plugin's job is the half that says so.
 *
 * The optimizer pre-bundles anything under `node_modules` and follows aliases
 * while it does — so it walks `lanka`'s dist out through `@lanka_di` and copies
 * the CONSUMER'S OWN SOURCE into `node_modules/.vite/deps`. That cache is keyed
 * by the lockfile, not by application source and not by `.env.*`, so from then
 * on the browser runs the copy taken on the day the cache was written and reads
 * that day's `import.meta.env`. Editing the file changes nothing and nothing is
 * reported: the file being executed is not the file being edited.
 */
describe("lankaDiVite — the dependency optimizer", () => {
	it("excludes the alias, so app source is never pre-bundled into deps/", () => {
		const config = runConfig(lankaDiVite(), makeRoot()) as {
			optimizeDeps: { exclude: readonly string[] };
		};

		expect(config.optimizeDeps.exclude).toContain(lankaDiContract.alias);
	});

	// Excluding `@lanka_di` and NOT `lanka` is the whole point. Vite matches an
	// exclude entry as a prefix, so the alias covers every `@lanka_di/*` barrel
	// and every package that reads one — while `lanka` itself stays pre-bundled
	// and costs the dev server nothing. Naming `lanka` here would opt the
	// framework out of optimisation to fix a problem it is not the cause of.
	it("excludes the alias and not the framework package", () => {
		const config = runConfig(lankaDiVite(), makeRoot()) as {
			optimizeDeps: { exclude: readonly string[] };
		};

		expect(config.optimizeDeps.exclude).toEqual([lankaDiContract.alias]);
	});
});

/**
 * The root vite settles on, which is not the root it starts with.
 *
 * `config` runs before vite has resolved the root, so a plugin that took it once
 * is holding `process.cwd()` — right for every project whose root IS the working
 * directory, and wrong for every other, which is why nobody notices until a
 * monorepo. The hook that fixes it had no test until this one.
 */
describe("lankaDiVite — the root vite resolves later", () => {
	it("scaffolds into the root from configResolved, not the one config saw", () => {
		const resolvedRoot = makeRoot();
		const plugin = lankaDiVite();

		runConfig(plugin, "C:/not/the/real/root");
		runConfigResolved(plugin, resolvedRoot);
		runBuildStart(plugin, makeContext());

		expect(existsSync(join(resolvedRoot, lankaDiContract.dirname, "Host.ts"))).toBe(true);
	});

	// An explicit root is the consumer saying it out loud, and vite's answer must
	// not overrule it — the two disagree exactly when somebody configured this on
	// purpose.
	it("still prefers an explicit root over the one vite resolved", () => {
		const mine = makeRoot();
		const viteRoot = makeRoot();
		const plugin = lankaDiVite({ root: mine });

		runConfigResolved(plugin, viteRoot);
		runBuildStart(plugin, makeContext());

		expect(existsSync(join(mine, lankaDiContract.dirname, "Host.ts"))).toBe(true);
		expect(existsSync(join(viteRoot, lankaDiContract.dirname))).toBe(false);
	});
});

/**
 * The half of the alias that has no browser in it.
 *
 * Vite externalises anything under `node_modules` for SSR, and an externalised
 * module is loaded by NODE — which has never heard of an alias vite invented.
 * `lanka`'s published code then asks node for `@lanka_di/Gateways` and is told
 * `Cannot find package`, on the server, in a project whose client half works.
 * Measured against a real `ssrLoadModule` before the fix; it is the whole
 * reason the contract names the framework's package at all.
 */
describe("lankaDiVite — the SSR build", () => {
	it("names the framework as one to process, not one to hand to node", () => {
		const config = runConfig(lankaDiVite(), makeRoot()) as {
			ssr: { noExternal: readonly string[] };
		};

		expect(config.ssr.noExternal).toEqual([lankaDiContract.packageName]);
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
