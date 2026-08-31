import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPlaygroundProject, playgroundRoot } from "./app";
import {
	lankaDefaultSkillTarget,
	lankaSkillMarker,
	findLankaSkillSources,
	lankaNodeSkillHost,
	planLankaSkillSync,
	runLankaSkillsCli,
	syncLankaSkills,
} from "../src/index";
import type { IFakeSkillHost } from "../src/_testing/createFakeSkillHost";

const run = (argv: string[], host: IFakeSkillHost) => {
	const out: string[] = [];
	const code = runLankaSkillsCli({
		argv,
		root: playgroundRoot,
		host,
		write: (text) => out.push(text),
		writeError: (text) => out.push(text),
	});
	return { code, out: out.join("") };
};

/**
 * The package, used the way a consumer uses it.
 *
 * The unit tests drive each decision on its own; what needs a whole project is
 * the SET — that a consumer gets the skills of what they installed and nothing
 * else, and that running the command twice is quiet the second time.
 */
describe("the skills playground", () => {
	it("installs a skill for each installed lanka package, and nothing for React", () => {
		const host = createPlaygroundProject();

		syncLankaSkills({ root: playgroundRoot, host });

		expect(host.copies.map((copy) => copy.to)).toEqual([
			`/app/${lankaDefaultSkillTarget}/lanka-http`,
			`/app/${lankaDefaultSkillTarget}/lanka-testing`,
			`/app/${lankaDefaultSkillTarget}/lanka-core`,
			`/app/${lankaDefaultSkillTarget}/lanka-packages`,
		]);
	});

	// The second run is where a tool that cannot recognise its own work starts
	// asking questions about directories it wrote a minute ago.
	it("is quiet the second time: everything it wrote is its own to update", () => {
		const host = createPlaygroundProject();

		syncLankaSkills({ root: playgroundRoot, host });
		const second = syncLankaSkills({ root: playgroundRoot, host });

		expect(second.conflict).toEqual([]);
		expect(second.install).toEqual([]);
		expect(second.update).toHaveLength(4);
	});

	it("upgrading a package re-copies its skill and records the new version", () => {
		const host = createPlaygroundProject();
		syncLankaSkills({ root: playgroundRoot, host });

		const before = host.copies.length;
		syncLankaSkills({ root: playgroundRoot, host });

		expect(host.copies).toHaveLength(before * 2);
		expect(JSON.parse(host.writes[host.writes.length - 1].text)).toMatchObject({
			version: "1.4.0",
		});
	});

	it("a hand-written skill of the consumer's survives a sync", () => {
		const host = createPlaygroundProject();
		host.add(`/app/${lankaDefaultSkillTarget}/lanka-core`);

		const result = run(["sync"], host);

		expect(result.out).toContain("lanka-core left alone");
		expect(host.copies.map((copy) => copy.to)).not.toContain(
			`/app/${lankaDefaultSkillTarget}/lanka-core`,
		);
	});

	// The way a project wires this into a check of its own: decide, read the
	// answer, write nothing. Everything the command does is reachable in pieces.
	it("can be asked what it would do, without the command", () => {
		const host = createPlaygroundProject();
		const target = `/app/${lankaDefaultSkillTarget}`;

		const sources = findLankaSkillSources({ root: playgroundRoot, host });
		const plan = planLankaSkillSync({ sources, target, host });

		expect(sources.map((source) => source.packageName)).toContain("@lankajs/plugin-http");
		expect(plan.install).toHaveLength(4);
		expect(host.copies).toEqual([]);
	});

	it("recognises its own marker as the thing that makes a directory ours", () => {
		const host = createPlaygroundProject();
		const target = `/app/${lankaDefaultSkillTarget}`;
		host.add(`${target}/lanka-core`);
		host.add(`${target}/lanka-core/${lankaSkillMarker}`);

		const plan = planLankaSkillSync({
			sources: findLankaSkillSources({ root: playgroundRoot, host }),
			target,
			host,
		});

		expect(plan.update.map((source) => source.skill)).toEqual(["lanka-core"]);
		expect(plan.conflict).toEqual([]);
	});

	// The one export that touches a real disk, used the way a consumer's script
	// uses it — against a project that does not exist, so the scene proves the
	// wiring without writing anything anywhere.
	it("works against a real file system, and finds nothing where there is nothing", () => {
		const absent = join(tmpdir(), "lanka-skills-playground-absent");

		const plan = syncLankaSkills({ root: absent, host: lankaNodeSkillHost, dryRun: true });

		expect(plan).toEqual({ install: [], update: [], conflict: [] });
	});

	it("`list` describes the same project without touching it", () => {
		const host = createPlaygroundProject();

		const result = run(["list"], host);

		expect(result.out).toContain("lanka-core would be installed");
		expect(result.out).toContain("(lanka@1.4.0)");
		expect(host.copies).toEqual([]);
		expect(host.writes).toEqual([]);
	});
});
