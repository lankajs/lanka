import { describe, expect, it } from "vitest";
import { createFakeSkillHost } from "../_testing/createFakeSkillHost";
import { syncLankaSkills } from "./syncLankaSkills";
import { lankaDefaultSkillTarget } from "../lanka-default-skill-target/lankaDefaultSkillTarget";
import { lankaSkillMarker } from "../lanka-skill-marker/lankaSkillMarker";

const ROOT = "/app";

const project = (extra: Parameters<typeof createFakeSkillHost>[0] = {}) =>
	createFakeSkillHost({
		json: {
			"/app/package.json": { dependencies: { lanka: "^1.0.0" } },
			"/app/node_modules/lanka/package.json": { version: "1.0.3" },
			...extra.json,
		},
		paths: ["/app/node_modules/lanka/skills", ...(extra.paths ?? [])],
		directories: {
			"/app/node_modules/lanka/skills": ["lanka-core"],
			...extra.directories,
		},
	});

describe("syncLankaSkills", () => {
	it("copies a skill into the default target", () => {
		const host = project();

		syncLankaSkills({ root: ROOT, host });

		expect(host.copies).toEqual([
			{
				from: "/app/node_modules/lanka/skills/lanka-core",
				to: `/app/${lankaDefaultSkillTarget}/lanka-core`,
			},
		]);
	});

	it("writes the marker AFTER the copy, so a half-written directory is never claimed", () => {
		const host = project();

		syncLankaSkills({ root: ROOT, host });

		expect(host.writes).toHaveLength(1);
		expect(host.writes[0].path).toBe(
			`/app/${lankaDefaultSkillTarget}/lanka-core/${lankaSkillMarker}`,
		);
	});

	it("records the package and the installed version in the marker", () => {
		const host = project();

		syncLankaSkills({ root: ROOT, host });

		expect(JSON.parse(host.writes[0].text)).toEqual({
			package: "lanka",
			version: "1.0.3",
			skill: "lanka-core",
		});
	});

	it("honours a target of the caller's choosing", () => {
		const host = project();

		syncLankaSkills({ root: ROOT, host, target: ".agent/skills" });

		expect(host.copies[0].to).toBe("/app/.agent/skills/lanka-core");
	});

	// A dry run has to be indistinguishable from a real one in what it REPORTS and
	// completely distinguishable in what it does.
	it("writes nothing on a dry run, and still answers the same plan", () => {
		const host = project();

		const plan = syncLankaSkills({ root: ROOT, host, dryRun: true });

		expect(plan.install.map((s) => s.skill)).toEqual(["lanka-core"]);
		expect(host.copies).toEqual([]);
		expect(host.writes).toEqual([]);
	});

	it("does not touch a directory it did not write", () => {
		const host = project({ paths: [`/app/${lankaDefaultSkillTarget}/lanka-core`] });

		const plan = syncLankaSkills({ root: ROOT, host });

		expect(plan.conflict.map((s) => s.skill)).toEqual(["lanka-core"]);
		expect(host.copies).toEqual([]);
	});

	it("replaces a foreign directory when forced", () => {
		const host = project({ paths: [`/app/${lankaDefaultSkillTarget}/lanka-core`] });

		syncLankaSkills({ root: ROOT, host, force: true });

		expect(host.copies).toHaveLength(1);
	});

	it("does nothing at all in a project with no lanka packages", () => {
		const empty = createFakeSkillHost({ json: { "/app/package.json": {} } });

		const plan = syncLankaSkills({ root: ROOT, host: empty });

		expect(plan).toEqual({ install: [], update: [], conflict: [] });
		expect(empty.copies).toEqual([]);
	});
});
