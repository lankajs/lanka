import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFakeSkillHost } from "../_testing/createFakeSkillHost";
import { runLankaSkillsCli } from "./runLankaSkillsCli";
import { lankaDefaultSkillTarget } from "../lanka-default-skill-target/lankaDefaultSkillTarget";

const ROOT = "/app";

const project = (extra: Parameters<typeof createFakeSkillHost>[0] = {}) =>
	createFakeSkillHost({
		json: {
			"/app/package.json": { dependencies: { lanka: "^1.0.0" } },
			"/app/node_modules/lanka/package.json": { version: "1.0.3" },
			...extra.json,
		},
		paths: ["/app/node_modules/lanka/skills", ...(extra.paths ?? [])],
		directories: { "/app/node_modules/lanka/skills": ["lanka-core"], ...extra.directories },
	});

const run = (argv: string[], host = project()) => {
	const out: string[] = [];
	const err: string[] = [];

	const code = runLankaSkillsCli({
		argv,
		root: ROOT,
		host,
		write: (text) => out.push(text),
		writeError: (text) => err.push(text),
	});

	return { code, out: out.join(""), err: err.join(""), host };
};

describe("runLankaSkillsCli", () => {
	it("syncs when told nothing", () => {
		const result = run([]);

		expect(result.code).toBe(0);
		expect(result.host.copies).toHaveLength(1);
		expect(result.out).toContain("lanka-core");
	});

	it("names the package and the version it installed", () => {
		expect(run(["sync"]).out).toContain("(lanka@1.0.3)");
	});

	it("`list` writes nothing", () => {
		const result = run(["list"]);

		expect(result.host.copies).toEqual([]);
		expect(result.out).toContain("would be installed");
	});

	it("`--dry-run` writes nothing either", () => {
		expect(run(["sync", "--dry-run"]).host.copies).toEqual([]);
	});

	it("takes a target from `--dir`", () => {
		expect(run(["sync", "--dir", ".agent/skills"]).host.copies[0].to).toBe(
			"/app/.agent/skills/lanka-core",
		);
	});

	// The refusal has to be VISIBLE, and it has to say what to do about it —
	// a silent skip reads as a successful sync that quietly did nothing.
	it("reports a directory it refused to replace, and says how to override", () => {
		const host = project({ paths: [`/app/${lankaDefaultSkillTarget}/lanka-core`] });

		const result = run(["sync"], host);

		expect(result.out).toContain("left alone");
		expect(result.out).toContain("--force");
		expect(result.code).toBe(0);
	});

	it("says so when there is nothing to do", () => {
		const empty = createFakeSkillHost({ json: { "/app/package.json": {} } });

		expect(run(["sync"], empty).out).toContain("nothing to do");
	});

	// Without a host it uses the real file system, and a project that does not
	// exist is the one way to prove that without writing anything anywhere.
	it("falls back to the real file system when given no host", () => {
		const out: string[] = [];

		const code = runLankaSkillsCli({
			argv: ["list"],
			root: join(tmpdir(), "lanka-skills-absent-project"),
			write: (text) => out.push(text),
			writeError: (text) => out.push(text),
		});

		expect(code).toBe(0);
		expect(out.join("")).toContain("nothing to do");
	});

	it("prints usage for --help", () => {
		const result = run(["--help"]);

		expect(result.out).toContain("lanka-skills sync");
		expect(result.out).toContain("--force");
		expect(result.code).toBe(0);
	});

	it("refuses an unknown command, on the error stream, and exits non-zero", () => {
		const result = run(["install"]);

		expect(result.code).toBe(1);
		expect(result.err).toContain('unknown command "install"');
		expect(result.out).toBe("");
	});
});
