import { describe, expect, it } from "vitest";
import { createFakeSkillHost } from "../_testing/createFakeSkillHost";
import { planLankaSkillSync } from "./planLankaSkillSync";
import { lankaSkillMarker } from "../lanka-skill-marker/lankaSkillMarker";
import type { ILankaSkillSource } from "../_interfaces/ILankaSkillSource";

const TARGET = "/app/.claude/skills";

const source = (skill: string): ILankaSkillSource => ({
	packageName: "lanka",
	version: "1.0.0",
	skill,
	dir: `/app/node_modules/lanka/skills/${skill}`,
});

describe("planLankaSkillSync", () => {
	it("installs what is not there", () => {
		const plan = planLankaSkillSync({
			sources: [source("lanka-core")],
			target: TARGET,
			host: createFakeSkillHost(),
		});

		expect(plan.install.map((s) => s.skill)).toEqual(["lanka-core"]);
		expect(plan.update).toEqual([]);
		expect(plan.conflict).toEqual([]);
	});

	it("updates what an earlier sync wrote", () => {
		const host = createFakeSkillHost({
			paths: [`${TARGET}/lanka-core`, `${TARGET}/lanka-core/${lankaSkillMarker}`],
		});

		const plan = planLankaSkillSync({ sources: [source("lanka-core")], target: TARGET, host });

		expect(plan.update.map((s) => s.skill)).toEqual(["lanka-core"]);
		expect(plan.install).toEqual([]);
	});

	// The rule this whole file exists for: a directory without the marker belongs
	// to the consumer, and replacing it destroys work nobody asked us to touch.
	it("leaves a directory it did not write alone", () => {
		const host = createFakeSkillHost({ paths: [`${TARGET}/lanka-core`] });

		const plan = planLankaSkillSync({ sources: [source("lanka-core")], target: TARGET, host });

		expect(plan.conflict.map((s) => s.skill)).toEqual(["lanka-core"]);
		expect(plan.install).toEqual([]);
		expect(plan.update).toEqual([]);
	});

	it("replaces a foreign directory only when told to", () => {
		const host = createFakeSkillHost({ paths: [`${TARGET}/lanka-core`] });

		const plan = planLankaSkillSync({
			sources: [source("lanka-core")],
			target: TARGET,
			host,
			force: true,
		});

		expect(plan.update.map((s) => s.skill)).toEqual(["lanka-core"]);
		expect(plan.conflict).toEqual([]);
	});

	it("sorts each source into exactly one list", () => {
		const host = createFakeSkillHost({
			paths: [
				`${TARGET}/lanka-core`,
				`${TARGET}/lanka-core/${lankaSkillMarker}`,
				`${TARGET}/lanka-sse`,
			],
		});

		const plan = planLankaSkillSync({
			sources: [source("lanka-core"), source("lanka-sse"), source("lanka-http")],
			target: TARGET,
			host,
		});

		expect(plan.install.length + plan.update.length + plan.conflict.length).toBe(3);
		expect(plan.install.map((s) => s.skill)).toEqual(["lanka-http"]);
		expect(plan.update.map((s) => s.skill)).toEqual(["lanka-core"]);
		expect(plan.conflict.map((s) => s.skill)).toEqual(["lanka-sse"]);
	});

	it("decides nothing when there is nothing to decide", () => {
		const plan = planLankaSkillSync({
			sources: [],
			target: TARGET,
			host: createFakeSkillHost(),
		});

		expect(plan).toEqual({ install: [], update: [], conflict: [] });
	});
});
