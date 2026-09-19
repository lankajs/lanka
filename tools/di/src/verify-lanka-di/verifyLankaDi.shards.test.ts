import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { lankaDiBridge } from "../lanka-di-bridge/lankaDiBridge";
import { verifyLankaDi } from "./verifyLankaDi";

/**
 * Pins what a project using BOTH barrel directories is allowed to look like.
 *
 * Two directories used to be a single message: "both present, one is dead
 * wiring". They are now a LAYOUT — a team may split by abstraction, keeping its
 * gateways in one and its host in the other, or by shard, keeping half its
 * gateways in each — and the rules that replaced that message are the subject
 * here.
 *
 * Every rule below falls out of one fact: `@lanka_di/Gateways` is an alias, an
 * alias names ONE file, and so the primary directory has to answer for every
 * barrel. What the other directory holds reaches the framework through a
 * re-export in that file, and nowhere else. The failures worth a test are the
 * ones that are silent without it — a shard nothing re-exports, and a name both
 * halves export, which ESM drops rather than reports.
 */

const roots: string[] = [];

const makeRoot = (): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-di-shards-"));
	roots.push(root);
	return root;
};

/** A project already scaffolded on `.lanka`, with an empty `.lanka_di` beside it. */
const twoDirectories = (): string => {
	const root = makeRoot();
	verifyLankaDi(root);
	mkdirSync(join(root, ".lanka_di"), { recursive: true });
	return root;
};

const write = (root: string, path: string, source: string): void =>
	writeFileSync(join(root, path), source, "utf8");

const read = (root: string, path: string): string => readFileSync(join(root, path), "utf8");

afterEach(() => {
	while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe("verifyLankaDi — a barrel sharded across both directories", () => {
	it("accepts the split when the primary re-exports the shard", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Gateways.ts", `export { SessionGateway } from "./x";\n`);
		write(
			root,
			".lanka/Gateways.ts",
			`${lankaDiBridge(".lanka_di", "Gateways.ts")}\nexport { MissionGateway } from "./y";\n`,
		);

		expect(verifyLankaDi(root).problems).toEqual([]);
	});

	// The failure this rule exists for. The shard type-checks, the export is
	// valid, the file is where the team put it — and the framework never reads it,
	// because nothing the alias resolves to mentions it. No error, anywhere.
	it("reports a shard nothing re-exports, and gives the line that fixes it", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Gateways.ts", `export { SessionGateway } from "./x";\n`);

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain(".lanka_di/Gateways.ts");
		expect(problems).toContain(lankaDiBridge(".lanka_di", "Gateways.ts"));
	});

	// A bridge somebody commented out while debugging is a bridge that is not
	// there. Reading the line rather than its effect is how the shard goes missing
	// with the check still green.
	it("does not count a commented-out bridge", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Gateways.ts", `export { SessionGateway } from "./x";\n`);
		write(root, ".lanka/Gateways.ts", `// ${lankaDiBridge(".lanka_di", "Gateways.ts")}\n`);

		expect(verifyLankaDi(root).problems.join("\n")).toContain(
			lankaDiBridge(".lanka_di", "Gateways.ts"),
		);
	});

	it("names both directories as in use", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Gateways.ts", `export {};\n`);
		write(root, ".lanka/Gateways.ts", lankaDiBridge(".lanka_di", "Gateways.ts"));

		expect(verifyLankaDi(root).directoriesInUse).toEqual([".lanka", ".lanka_di"]);
	});
});

describe("verifyLankaDi — a barrel that lives only in the other directory", () => {
	// Splitting by ABSTRACTION: the gateways over there, everything else here.
	// The consumer does not configure anything for this; the alias still resolves
	// to the primary, so the primary is given a file that says where the rest is.
	it("writes the bridge rather than an empty stub that would shadow it", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Gateways.ts"));
		write(root, ".lanka_di/Gateways.ts", `export { SessionGateway } from "./x";\n`);

		const report = verifyLankaDi(root);

		expect(report.created).toContain(".lanka/Gateways.ts");
		expect(read(root, ".lanka/Gateways.ts")).toContain(
			lankaDiBridge(".lanka_di", "Gateways.ts"),
		);
		expect(report.problems).toEqual([]);
	});

	it("leaves the shard itself untouched", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Gateways.ts"));
		const mine = `export { SessionGateway } from "./x";\n`;
		write(root, ".lanka_di/Gateways.ts", mine);

		verifyLankaDi(root);

		expect(read(root, ".lanka_di/Gateways.ts")).toBe(mine);
	});

	// The CI posture writes nothing, so it has to SAY the line instead — naming
	// the file, the shard it is for, and the one line that joins them.
	it("reports the missing bridge instead of writing it, with scaffolding off", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Gateways.ts"));
		write(root, ".lanka_di/Gateways.ts", `export {};\n`);

		const problems = verifyLankaDi(root, { scaffold: false }).problems.join("\n");

		expect(problems).toContain(lankaDiBridge(".lanka_di", "Gateways.ts"));
		expect(problems).not.toContain("is missing.");
	});

	// A barrel the framework reads BY NAME still counts as answered when the name
	// arrives through the bridge. Demanding the declaration in the primary would
	// make "the host lives in the other directory" impossible to express.
	it("counts a required export that arrives through the bridge", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Host.ts"));
		write(root, ".lanka_di/Host.ts", `export const lankaHost = { apiBaseUrl: "/api" };\n`);

		expect(verifyLankaDi(root).problems).toEqual([]);
	});

	it("still reports a required export that is in neither", () => {
		const root = twoDirectories();
		write(root, ".lanka/Host.ts", `export const somethingElse = 1;\n`);

		expect(verifyLankaDi(root).problems.join("\n")).toContain("lankaHost");
	});
});

describe("verifyLankaDi — what may not be sharded", () => {
	// A namespace barrel is a LIST and two of them are two halves of one. A barrel
	// the framework reads by name is one VALUE, and there is no union of two
	// hosts: the second copy is not a shard, it is a second answer that nothing
	// reads.
	it("refuses two hosts, because a host is a value and not a list", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Host.ts", `export const lankaHost = { apiBaseUrl: "/other" };\n`);

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain("lankaHost");
		expect(problems).toContain("dead wiring");
	});

	it("refuses two contract stamps for the same reason", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Contract.ts", `export const lankaDiContractVersion = 1;\n`);

		expect(verifyLankaDi(root).problems.join("\n")).toContain("lankaDiContractVersion");
	});

	// Both halves exporting one name is the single failure sharding adds, and it
	// is the worst kind: ESM resolves the ambiguity by dropping the name, so the
	// gateway is in neither namespace and nothing anywhere says so.
	it("reports a name both halves export", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Gateways.ts", `export { SessionGateway } from "./x";\n`);
		write(
			root,
			".lanka/Gateways.ts",
			`${lankaDiBridge(".lanka_di", "Gateways.ts")}\nexport { SessionGateway } from "./y";\n`,
		);

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain("SessionGateway");
		expect(problems).toContain("dropping it");
	});

	it("says nothing about a name only one half exports", () => {
		const root = twoDirectories();
		write(root, ".lanka_di/Gateways.ts", `export { SessionGateway } from "./x";\n`);
		write(
			root,
			".lanka/Gateways.ts",
			`${lankaDiBridge(".lanka_di", "Gateways.ts")}\nexport { MissionGateway } from "./y";\n`,
		);

		expect(verifyLankaDi(root).problems).toEqual([]);
	});

	// The scaffolded stub carries `@example export { UserGateway } from "../src/...";`
	// inside its doc comment. Read without dropping comments, every untouched
	// project shards two barrels that both "export" `UserGateway`.
	it("does not read an example inside a doc comment as an export", () => {
		const root = twoDirectories();
		const stub = read(root, ".lanka/Gateways.ts");
		write(root, ".lanka_di/Gateways.ts", stub);
		write(root, ".lanka/Gateways.ts", `${stub}${lankaDiBridge(".lanka_di", "Gateways.ts")}\n`);

		expect(verifyLankaDi(root).problems).toEqual([]);
	});
});

describe("verifyLankaDi — the tsconfig of a project using both", () => {
	const tsconfig = (include: readonly string[]): string =>
		`${JSON.stringify({ compilerOptions: { paths: { "@lanka_di/*": ["./.lanka/*"] } }, include }, null, "\t")}\n`;

	it("asks for the second directory in the include as well", () => {
		const root = twoDirectories();
		write(root, "tsconfig.json", tsconfig(["src/**/*", ".lanka/**/*"]));
		write(root, ".lanka_di/Gateways.ts", `export {};\n`);
		write(root, ".lanka/Gateways.ts", lankaDiBridge(".lanka_di", "Gateways.ts"));

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain(".lanka_di/**/*");
	});

	it("is satisfied when both are there", () => {
		const root = twoDirectories();
		write(root, "tsconfig.json", tsconfig(["src/**/*", ".lanka/**/*", ".lanka_di/**/*"]));
		write(root, ".lanka_di/Gateways.ts", `export {};\n`);
		write(root, ".lanka/Gateways.ts", lankaDiBridge(".lanka_di", "Gateways.ts"));

		expect(verifyLankaDi(root).problems).toEqual([]);
	});

	// `.lanka` is a PREFIX of `.lanka_di`, so a substring test answers yes to the
	// wrong one in exactly the layout where both names appear.
	it("does not accept `.lanka` as though it named `.lanka_di`", () => {
		const root = twoDirectories();
		write(root, "tsconfig.json", tsconfig(["src/**/*", ".lanka/**/*"]));
		write(root, ".lanka_di/Singletons.ts", `export {};\n`);
		write(root, ".lanka/Singletons.ts", lankaDiBridge(".lanka_di", "Singletons.ts"));

		expect(verifyLankaDi(root).problems.join("\n")).toContain(".lanka_di/**/*");
	});
});

describe("verifyLankaDi — the contract stamp of a project using both", () => {
	it("reads the version through a bridged Contract.ts", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Contract.ts"));
		write(root, ".lanka_di/Contract.ts", `export const lankaDiContractVersion = 1;\n`);

		expect(verifyLankaDi(root).problems).toEqual([]);
	});

	it("reports a wrong version wherever the stamp actually is", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Contract.ts"));
		write(root, ".lanka_di/Contract.ts", `export const lankaDiContractVersion = 99;\n`);

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain("99");
		expect(problems).toContain(".lanka_di");
	});
});

describe("verifyLankaDi — saying which directory the answer is missing from", () => {
	// A required export missing from the file the alias resolves to is the usual
	// message. Missing from BOTH halves is a different sentence, because a reader
	// whose host is in the other directory would otherwise go and look at the
	// file that was never supposed to have it.
	it("names both files when neither carries the required export", () => {
		const root = twoDirectories();
		write(root, ".lanka/Host.ts", `export const somethingElse = 1;\n`);
		write(root, ".lanka_di/Host.ts", `export const alsoNot = 2;\n`);

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain(".lanka/Host.ts");
		expect(problems).toContain(`Neither does .lanka_di/Host.ts`);
	});

	// One collision reads "that name is", several read "those names are". A
	// message that says "1 names" is a message somebody stops reading.
	it("counts the collisions it found", () => {
		const root = twoDirectories();
		write(
			root,
			".lanka_di/Scenarios.ts",
			`export { A } from "./x";\nexport { B } from "./x";\n`,
		);
		write(
			root,
			".lanka/Scenarios.ts",
			`${lankaDiBridge(".lanka_di", "Scenarios.ts")}\nexport { A } from "./y";\nexport { B } from "./y";\n`,
		);

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain("those names are");
		expect(problems).toContain("`A`, `B`");
	});
});

/**
 * Running twice must say what running once said.
 *
 * This package both WRITES and JUDGES, and the plugin calls it at `buildStart` —
 * so a file it creates on the first run is a file it reads on the second. A rule
 * that does not know the difference between what a consumer wrote and what this
 * wrote condemns its own output, on every build after the first, with a message
 * telling somebody to delete the half that holds their work.
 *
 * Every scene here calls `verifyLankaDi` at least twice on purpose. A spec that
 * called it once was green over exactly that bug.
 */
describe("verifyLankaDi — twice over the same project", () => {
	it("says nothing the second time about a bridge it wrote itself", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Host.ts"));
		write(root, ".lanka_di/Host.ts", `export const lankaHost = { apiBaseUrl: "/api" };\n`);

		const first = verifyLankaDi(root);
		const second = verifyLankaDi(root);

		expect(first.created).toContain(".lanka/Host.ts");
		expect(second.problems).toEqual([]);
		expect(second.created).toEqual([]);
	});

	it("is idempotent over a namespace barrel it bridged too", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Gateways.ts"));
		write(root, ".lanka_di/Gateways.ts", `export { SessionGateway } from "./x";\n`);

		verifyLankaDi(root);

		expect(verifyLankaDi(root).problems).toEqual([]);
	});

	// The value rule is about DECLARATIONS, not about files. Two files exist here
	// and only one of them says `lankaHost`; the other is the line that reaches it.
	it("counts declarations, not copies, before calling a barrel a second answer", () => {
		const root = twoDirectories();
		rmSync(join(root, ".lanka/Contract.ts"));
		write(root, ".lanka_di/Contract.ts", `export const lankaDiContractVersion = 1;\n`);

		verifyLankaDi(root);

		expect(verifyLankaDi(root).problems).toEqual([]);
	});
});

describe("verifyLankaDi — a value declared next door and not reached", () => {
	// The case a value barrel shares with a shard: the host exists, and the file
	// the framework actually opens does not mention it. It is not "two hosts" —
	// there is only one — and it is not "no host"; it is one line missing, and the
	// message has to be that line rather than either of the other two.
	it("names the line rather than reporting a missing export", () => {
		const root = twoDirectories();
		write(root, ".lanka/Host.ts", `export const helper = 1;\n`);
		write(root, ".lanka_di/Host.ts", `export const lankaHost = { apiBaseUrl: "/api" };\n`);

		const problems = verifyLankaDi(root, { scaffold: false }).problems.join("\n");

		expect(problems).toContain(lankaDiBridge(".lanka_di", "Host.ts"));
		expect(problems).not.toContain("both declare");
	});

	it("goes quiet once the line is there", () => {
		const root = twoDirectories();
		write(
			root,
			".lanka/Host.ts",
			`${lankaDiBridge(".lanka_di", "Host.ts")}\nexport const helper = 1;\n`,
		);
		write(root, ".lanka_di/Host.ts", `export const lankaHost = { apiBaseUrl: "/api" };\n`);

		expect(verifyLankaDi(root, { scaffold: false }).problems).toEqual([]);
	});
});

describe("verifyLankaDi — an unreadable contract stamp on a split project", () => {
	// The bridge is the one file that is RIGHT to have no version in it, and it is
	// the file the alias resolves to. Naming it would send somebody to fix the
	// half that is already correct.
	it("names the directory that should carry the number, not the one that bridges to it", () => {
		const root = twoDirectories();
		write(root, ".lanka/Contract.ts", lankaDiBridge(".lanka_di", "Contract.ts"));
		write(root, ".lanka_di/Contract.ts", `export const somethingElse = 1;\n`);

		const problems = verifyLankaDi(root, { scaffold: false }).problems.join("\n");

		expect(problems).toContain(".lanka_di/Contract.ts: the contract version is unreadable");
	});
});
