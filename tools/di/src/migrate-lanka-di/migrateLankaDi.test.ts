import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLankaDi } from "./migrateLankaDi";
import { verifyLankaDi } from "../verify-lanka-di/verifyLankaDi";

const roots: string[] = [];

const TSCONFIG = (dirname: string): string => `{
	"compilerOptions": { "paths": { "@lanka_di/*": ["${dirname}/*"] } },
	"include": ["src/**/*", "${dirname}/**/*"]
}
`;

/** A project wired the old way: barrels on disk, and a tsconfig that names them. */
const makeProject = (dirname: string): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-migrate-"));
	roots.push(root);
	verifyLankaDi(root, { dirname: dirname as ".lanka" | ".lanka_di" });
	writeFileSync(join(root, "tsconfig.json"), TSCONFIG(dirname), "utf8");
	return root;
};

const read = (root: string, file: string): string => readFileSync(join(root, file), "utf8");

afterEach(() => {
	while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe("migrateLankaDi — the move", () => {
	it("renames the directory and takes the barrels with it", () => {
		const root = makeProject(".lanka_di");

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.from).toBe(".lanka_di");
		expect(existsSync(join(root, ".lanka_di"))).toBe(false);
		expect(existsSync(join(root, ".lanka", "Gateways.ts"))).toBe(true);
		expect(result.problems).toEqual([]);
	});

	// The two steps that do not fail on their own. A stale `paths` mapping and a
	// stale `include` both compile, and the file that wires the whole application
	// is left with no types and no error — which is why the migration does them
	// rather than telling a person to remember.
	it("rewrites the tsconfig mapping AND the include", () => {
		const root = makeProject(".lanka_di");

		migrateLankaDi({ root, to: ".lanka" });

		const tsconfig = read(root, "tsconfig.json");
		expect(tsconfig).toContain('"@lanka_di/*": [".lanka/*"]');
		expect(tsconfig).toContain('".lanka/**/*"');
		expect(tsconfig).not.toContain(".lanka_di/");
	});

	// The end state is the one the verifier calls healthy. Asserting the steps
	// individually would let a migration pass while leaving a project the build
	// still refuses.
	it("leaves a project the verifier has nothing to say about", () => {
		const root = makeProject(".lanka_di");

		migrateLankaDi({ root, to: ".lanka" });

		const report = verifyLankaDi(root, { scaffold: false });
		expect(report.problems).toEqual([]);
		expect(report.dirname).toBe(".lanka");
	});

	// `.lanka_di` is an alternative, not a deprecation. A team that prefers the
	// explicit name gets the same three steps, and the naive replacement in this
	// direction is the one that produces `.lanka_di_di`.
	it("migrates the other way too, without doubling the suffix", () => {
		const root = makeProject(".lanka");

		migrateLankaDi({ root, to: ".lanka_di" });

		expect(existsSync(join(root, ".lanka_di", "Host.ts"))).toBe(true);
		expect(read(root, "tsconfig.json")).toContain('".lanka_di/**/*"');
		expect(read(root, "tsconfig.json")).not.toContain("_di_di");
	});

	// A vite project splits the mapping across `tsconfig.app.json` and
	// `tsconfig.node.json`. Migrating the root one alone leaves the half that
	// actually compiles the application pointing at a directory that is gone.
	it("rewrites every tsconfig at the root, not only tsconfig.json", () => {
		const root = makeProject(".lanka_di");
		writeFileSync(join(root, "tsconfig.app.json"), TSCONFIG(".lanka_di"), "utf8");

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(read(root, "tsconfig.app.json")).toContain('".lanka/**/*"');
		expect(result.steps).toContain("tsconfig.app.json: .lanka_di → .lanka");
	});

	it("leaves a file it was never asked about alone", () => {
		const root = makeProject(".lanka_di");
		writeFileSync(join(root, "notes.md"), "we keep ours in .lanka_di\n", "utf8");

		migrateLankaDi({ root, to: ".lanka" });

		expect(read(root, "notes.md")).toContain(".lanka_di");
	});
});

describe("migrateLankaDi — what it refuses", () => {
	it("writes nothing on a dry run, and says the same thing it would have done", () => {
		const root = makeProject(".lanka_di");

		const planned = migrateLankaDi({ root, to: ".lanka", dryRun: true });
		const done = migrateLankaDi({ root, to: ".lanka" });

		// The rehearsal is only worth running if it matches the performance.
		expect(planned.steps).toEqual(done.steps);
		expect(planned.dryRun).toBe(true);
	});

	it("keeps the old directory on a dry run", () => {
		const root = makeProject(".lanka_di");

		migrateLankaDi({ root, to: ".lanka", dryRun: true });

		expect(existsSync(join(root, ".lanka_di"))).toBe(true);
		expect(existsSync(join(root, ".lanka"))).toBe(false);
	});

	it("says so when there is no barrel directory at all", () => {
		const root = mkdtempSync(join(tmpdir(), "lanka-migrate-"));
		roots.push(root);

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.problems.join("\n")).toContain("no barrel directory");
	});

	it("is a no-op, not a failure, on a project already where it asked to be", () => {
		const root = makeProject(".lanka");

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.from).toBeNull();
		expect(result.problems).toEqual([]);
		expect(result.steps).toEqual([]);
	});

	// A project with no tsconfig at all is legal — a plain JS build. The rename
	// still has to happen, and the report must not claim a file it never touched.
	it("migrates a project that has no tsconfig, and says only what it did", () => {
		const root = mkdtempSync(join(tmpdir(), "lanka-migrate-"));
		roots.push(root);
		verifyLankaDi(root, { dirname: ".lanka_di" });

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.steps).toEqual([".lanka_di/ → .lanka/"]);
		expect(existsSync(join(root, ".lanka", "Host.ts"))).toBe(true);
	});

	// A tsconfig that never named the directory is not a file this command has
	// business rewriting. Listing it would be a step that changed nothing, and a
	// report that overstates is a report nobody reads closely the next time.
	it("leaves a tsconfig that does not name the directory out of the report", () => {
		const root = mkdtempSync(join(tmpdir(), "lanka-migrate-"));
		roots.push(root);
		verifyLankaDi(root, { dirname: ".lanka_di" });
		writeFileSync(join(root, "tsconfig.json"), `{ "include": ["src/**/*"] }`, "utf8");

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.steps).toEqual([".lanka_di/ → .lanka/"]);
		expect(read(root, "tsconfig.json")).toBe(`{ "include": ["src/**/*"] }`);
	});

	it("defaults to the contract's default when no target is given", () => {
		const root = makeProject(".lanka_di");

		expect(migrateLankaDi({ root }).to).toBe(".lanka");
	});
});

/**
 * Leaving a two-directory layout, which used to be the one thing this refused.
 *
 * Two directories are now a layout a project may keep on purpose, so the command
 * that ends one has to MERGE rather than refuse. What it may move without
 * writing anybody's code is the whole subject: a file that exports nothing of
 * its own — the bridge written for a sharded barrel, the stub written for an
 * empty one — stands aside, and two files that both export names do not.
 */
describe("migrateLankaDi — merging two directories into one", () => {
	/** A project that keeps its gateways in `.lanka_di` and everything else in `.lanka`. */
	const sharded = (): string => {
		const root = makeProject(".lanka");
		mkdirSync(join(root, ".lanka_di"), { recursive: true });
		writeFileSync(
			join(root, ".lanka_di", "Gateways.ts"),
			`export { SessionGateway } from "../src/x";\n`,
			"utf8",
		);
		rmSync(join(root, ".lanka", "Gateways.ts"));
		verifyLankaDi(root);
		return root;
	};

	it("moves the barrel the other directory held", () => {
		const root = sharded();

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.problems).toEqual([]);
		expect(read(root, ".lanka/Gateways.ts")).toContain("SessionGateway");
		expect(existsSync(join(root, ".lanka_di"))).toBe(false);
	});

	// The bridge is wiring this package wrote, holding one line the consumer did
	// not type. Counting it as work would refuse every merge of a project that
	// has been built once, which is every project.
	it("replaces a bridge with the file it pointed at", () => {
		const root = sharded();

		expect(read(root, ".lanka/Gateways.ts")).toContain(`"../.lanka_di/Gateways"`);

		migrateLankaDi({ root, to: ".lanka" });

		expect(read(root, ".lanka/Gateways.ts")).not.toContain(".lanka_di");
	});

	it("drops the directory that is gone from the tsconfig instead of naming it twice", () => {
		const root = sharded();
		writeFileSync(
			join(root, "tsconfig.json"),
			`{\n\t"compilerOptions": { "paths": { "@lanka_di/*": [".lanka/*"] } },\n\t"include": ["src/**/*", ".lanka/**/*", ".lanka_di/**/*"]\n}\n`,
			"utf8",
		);

		migrateLankaDi({ root, to: ".lanka" });

		const tsconfig = read(root, "tsconfig.json");

		expect(tsconfig).not.toContain(".lanka_di");
		expect(tsconfig.match(/\.lanka\/\*\*\/\*/g)).toHaveLength(1);
	});

	it("reports every move it would make, and writes none of them, on a dry run", () => {
		const root = sharded();

		const result = migrateLankaDi({ root, to: ".lanka", dryRun: true });

		expect(result.steps.join("\n")).toContain(".lanka_di/Gateways.ts → .lanka/Gateways.ts");
		expect(existsSync(join(root, ".lanka_di", "Gateways.ts"))).toBe(true);
	});

	// Two halves of one list. Choosing the order is editing a file somebody wrote,
	// and a tool that guessed would have done it before they disagreed.
	it("refuses a barrel both directories export from, and writes nothing at all", () => {
		const root = sharded();
		writeFileSync(
			join(root, ".lanka", "Gateways.ts"),
			`export * from "../.lanka_di/Gateways";\nexport { MissionGateway } from "../src/y";\n`,
			"utf8",
		);

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.problems.join("\n")).toContain("Gateways.ts");
		expect(result.problems.join("\n")).toContain("exports of its own");
		expect(existsSync(join(root, ".lanka_di", "Gateways.ts"))).toBe(true);
		expect(read(root, ".lanka/Gateways.ts")).toContain("MissionGateway");
	});

	// Removing a directory with somebody's own files in it is not a migration.
	it("refuses to empty a directory holding something it does not know", () => {
		const root = sharded();
		writeFileSync(join(root, ".lanka_di", "notes.md"), "mine\n", "utf8");

		const result = migrateLankaDi({ root, to: ".lanka" });

		expect(result.problems.join("\n")).toContain("notes.md");
		expect(existsSync(join(root, ".lanka_di"))).toBe(true);
	});

	it("leaves a project the verifier has nothing to say about", () => {
		const root = sharded();

		migrateLankaDi({ root, to: ".lanka" });

		expect(verifyLankaDi(root, { scaffold: false }).problems).toEqual([]);
	});

	it("merges the other way too", () => {
		const root = sharded();

		const result = migrateLankaDi({ root, to: ".lanka_di" });

		expect(result.problems).toEqual([]);
		expect(existsSync(join(root, ".lanka"))).toBe(false);
		expect(read(root, ".lanka_di/Host.ts")).toContain("lankaHost");
	});
});
