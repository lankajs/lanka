import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { verifyLankaDi } from "../../../tools/di/src/verify-lanka-di/verifyLankaDi";
import * as Gateways from "@lanka_di/Gateways";
import * as Singletons from "@lanka_di/Singletons";

/**
 * The only application here that keeps its wiring in BOTH barrel directories.
 *
 * `.lanka` and `.lanka_di` are both legal and a project may use them together —
 * the axis belongs to the team, and the framework has no opinion about it. This
 * application carries the layout so that it is proved by a real program with a
 * real `tsconfig` and a real module resolver, rather than only by unit tests in
 * a temporary directory:
 *
 * - **by abstraction** — the singletons and the host live entirely in
 *   `.lanka_di`, and their files in `.lanka` are the one line that reaches each;
 * - **by shard** — the gateways are split, the mission gateway in `.lanka` and
 *   the session gateway in `.lanka_di`, joined by a re-export.
 *
 * Only one of the two is ever resolved directly: `@lanka_di/*` maps to `.lanka`,
 * so everything in the other directory arrives through a line in this one. That
 * is what these scenes read — that the alias reaches BOTH halves, and that the
 * tool agrees this arrangement is healthy.
 *
 * The locator half of the same claim is in `atlas-node.live.test.ts`, which has
 * a framework running to ask.
 */
const root = fileURLToPath(new URL("..", import.meta.url));

describe("a project whose barrels live in two directories", () => {
	// The shard. Both names arrive under one alias, and the second one is the
	// whole point: without the re-export it is silently absent — no build error,
	// no type error, just a gateway the locator has never heard of.
	it("reaches a gateway from each directory through one alias", () => {
		expect(Object.keys(Gateways)).toEqual(
			expect.arrayContaining(["AtlasMissionGateway", "AtlasSessionGateway"]),
		);
	});

	// The abstraction split. `.lanka/Singletons.ts` exports nothing of its own.
	it("reaches a barrel that lives entirely in the other directory", () => {
		expect(Object.keys(Singletons)).toEqual(["AtlasClock"]);
	});

	// The tool's own verdict on this application, with scaffolding off, which is
	// the posture a CI build uses. It reads the same two directories, checks that
	// every shard is re-exported, that no name is exported from both halves, and
	// that the `tsconfig` names both — the four ways this layout goes wrong.
	it("is a layout `@lankajs/tool-di` reports nothing about", () => {
		const report = verifyLankaDi(root, { scaffold: false });

		expect(report.problems).toEqual([]);
		expect(report.directoriesInUse).toEqual([".lanka", ".lanka_di"]);
	});

	// The alias resolves to ONE directory, and which one decides where a
	// re-export has to live. An application that stopped agreeing with the tool
	// about this would keep compiling and stop being read.
	it("resolves the alias to the directory the bridges are written in", () => {
		expect(verifyLankaDi(root, { scaffold: false }).dirname).toBe(".lanka");
	});
});

/**
 * The barrel class that is a VALUE, living in the other directory.
 *
 * `Host.ts` cannot be sharded — there is no union of two hosts — but it can live
 * next door behind a re-export, and the two rules are easy to conflate. They
 * were: the first version of this counted files rather than declarations, so the
 * re-export it had just written was reported as a second host on the next build.
 * A namespace barrel would not have caught it, which is why this application
 * carries one of each.
 */
describe("a barrel the framework reads by name, in the other directory", () => {
	it("reaches the host through the file the alias resolves to", async () => {
		const Host = await import("@lanka_di/Host");

		expect(Object.keys(Host)).toEqual(["lankaHost"]);
	});

	it("is not reported as two hosts on the second run, or the third", () => {
		verifyLankaDi(root, { scaffold: false });
		verifyLankaDi(root, { scaffold: false });

		expect(verifyLankaDi(root, { scaffold: false }).problems).toEqual([]);
	});
});
