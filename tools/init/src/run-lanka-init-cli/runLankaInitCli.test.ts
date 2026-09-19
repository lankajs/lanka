import { describe, expect, it } from "vitest";
import { createFakeInitHost } from "../_testing/createFakeInitHost";
import { runLankaInitCli } from "./runLankaInitCli";
import type { IFakeInitHostState } from "../_testing/createFakeInitHost";

const MANIFEST = JSON.stringify({ name: "app" });

const run = async (argv: readonly string[], state: IFakeInitHostState = {}) => {
	const host = createFakeInitHost({ files: { "/app/package.json": MANIFEST }, ...state });
	const out: string[] = [];
	const errors: string[] = [];

	const code = await runLankaInitCli({
		argv,
		root: "/app",
		host,
		write: (text) => out.push(text),
		writeError: (text) => errors.push(text),
	});

	return { code, host, out: out.join(""), errors: errors.join("") };
};

describe("the command", () => {
	it("prints what it is for when asked for help", async () => {
		const { code, out } = await run(["--help"]);

		expect(code).toBe(0);
		expect(out).toContain("lanka-init plan");
		expect(out).toContain("Nothing is ever overwritten");
	});

	it("says it does not create the application, where somebody will read it", async () => {
		expect((await run(["help"])).out).toMatch(/does not create the application/);
	});

	it("lists every template and answer with what each one installs", async () => {
		const { code, out } = await run(["list"]);

		expect(code).toBe(0);
		expect(out).toContain("react-spa");
		expect(out).toContain("@lankajs/plugin-http");
		expect(out).toContain("mmkv");
	});

	it("refuses a command it does not have, and shows the three it does", async () => {
		const { code, errors } = await run(["scaffold"]);

		expect(code).toBe(1);
		expect(errors).toContain('unknown command "scaffold"');
		expect(errors).toContain("lanka-init list");
	});

	it("writes the wiring and installs it", async () => {
		const { code, host, out } = await run(["--yes"]);

		expect(code).toBe(0);
		expect(host.writes.map((one) => one.path)).toContain("/app/.lanka/Contract.ts");
		expect(host.commands).toHaveLength(2);
		expect(out).toContain("Wrote");
	});

	it("`plan` decides and writes nothing", async () => {
		const { code, host, out } = await run(["plan", "--yes"]);

		expect(code).toBe(0);
		expect(host.writes).toEqual([]);
		expect(host.commands).toEqual([]);
		expect(out).toContain("Would write");
	});

	it("--dry-run is the same thing said as a flag", async () => {
		const { host } = await run(["--dry-run", "--yes"]);

		expect(host.writes).toEqual([]);
	});

	it("--no-install writes the files and leaves the package manager alone", async () => {
		const { host } = await run(["--yes", "--no-install"]);

		expect(host.writes.length).toBeGreaterThan(0);
		expect(host.commands).toEqual([]);
	});

	it("takes the answers from the flags", async () => {
		const { host, out } = await run([
			"--yes",
			"--template",
			"vue-spa",
			"--validator",
			"arktype",
			"--with",
			"prefetch,testing",
		]);

		expect(out).toContain("vue-spa");
		expect(host.writes.map((one) => one.path)).toContain(
			"/app/src/Modules/Todo/TodoScreen.vue",
		);
		expect(host.writes.map((one) => one.path)).toContain("/app/vitest.config.ts");
		expect(host.writes.map((one) => one.path)).not.toContain("/app/eslint.config.mjs");
	});

	it("writes the base URL it was given into the host, and nowhere else", async () => {
		const { host } = await run(["--yes", "--api-url", "https://api.example.com"]);
		const appHost = host.writes.find((one) => one.path.endsWith("Core/Configs/appHost.ts"));

		expect(appHost?.text).toContain('"https://api.example.com"');
	});

	it("takes a root that is not the working directory", async () => {
		const { host } = await run(["--yes", "--root", "/elsewhere", "--no-install"]);

		expect(host.writes.every((one) => one.path.startsWith("/elsewhere/"))).toBe(true);
	});

	/*
	 * The shape that would otherwise scaffold the default template silently: the
	 * flag is there, the value is not, and `argv[at + 1]` answers `undefined` —
	 * which is indistinguishable from the flag being absent.
	 */
	it("refuses a flag with nothing after it rather than defaulting", async () => {
		const { code, errors } = await run(["--yes", "--template"]);

		expect(code).toBe(1);
		expect(errors).toContain("--template needs a value");
	});

	it("refuses a flag followed by another flag", async () => {
		expect((await run(["--template", "--yes"])).code).toBe(1);
	});

	it("names an answer it does not know rather than choosing one", async () => {
		const { code, errors } = await run(["--yes", "--validator", "joi"]);

		expect(code).toBe(1);
		expect(errors).toContain('unknown validator "joi"');
	});

	/*
	 * A script that ran this and read zero would go on to build a project whose
	 * dependencies are not there.
	 */
	it("exits non-zero when the package manager failed", async () => {
		const { code, out } = await run(["--yes"], { exitCode: 7 });

		expect(code).toBe(1);
		expect(out).toContain("FAILED, exit code 7");
	});

	it("asks when there is somebody to ask", async () => {
		const { host } = await run([], { answers: { template: "solid-spa" } });

		expect(host.asked.map((one) => one.subject)).toEqual([
			"template",
			"validator",
			"transport",
			"storage",
			"extras",
		]);
		expect(host.writes.map((one) => one.path)).toContain(
			"/app/src/Modules/Todo/TodoScreen.tsx",
		);
	});

	it("reports what it left alone, and what is still to do", async () => {
		const { out } = await run(["--yes", "--no-install"], {
			files: { "/app/package.json": MANIFEST, "/app/vite.config.ts": "export default {};" },
		});

		expect(out).toContain("Left alone");
		expect(out).toContain("vite.config.ts");
		expect(out).toContain("Still yours to do");
	});
});
