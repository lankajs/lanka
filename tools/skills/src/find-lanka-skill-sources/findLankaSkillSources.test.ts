import { describe, expect, it } from "vitest";
import { createFakeSkillHost } from "../_testing/createFakeSkillHost";
import { findLankaSkillSources } from "./findLankaSkillSources";

const ROOT = "/app";

const host = (extra: Parameters<typeof createFakeSkillHost>[0] = {}) =>
	createFakeSkillHost({
		json: {
			"/app/package.json": {
				dependencies: { lanka: "^1.0.0", react: "^19.0.0" },
				devDependencies: { "@lankajs/tool-testing": "^1.2.0" },
			},
			"/app/node_modules/lanka/package.json": { version: "1.0.3" },
			"/app/node_modules/@lankajs/tool-testing/package.json": { version: "1.2.1" },
			...extra.json,
		},
		paths: [
			"/app/node_modules/lanka/skills",
			"/app/node_modules/@lankajs/tool-testing/skills",
			...(extra.paths ?? []),
		],
		directories: {
			"/app/node_modules/lanka/skills": ["lanka-core", "lanka-packages"],
			"/app/node_modules/@lankajs/tool-testing/skills": ["lanka-testing"],
			...extra.directories,
		},
	});

describe("findLankaSkillSources", () => {
	it("finds a skill in every lanka package the project declared", () => {
		const found = findLankaSkillSources({ root: ROOT, host: host() });

		expect(found.map((source) => source.skill)).toEqual([
			"lanka-testing",
			"lanka-core",
			"lanka-packages",
		]);
	});

	// The version is the entire reason this transport exists beside the plugin
	// marketplace, so it comes from node_modules and from nowhere else.
	it("records the version installed, not the range declared", () => {
		const found = findLankaSkillSources({ root: ROOT, host: host() });

		expect(found.find((source) => source.skill === "lanka-core")?.version).toBe("1.0.3");
	});

	it("ignores dependencies that are not lanka packages", () => {
		const found = findLankaSkillSources({ root: ROOT, host: host() });

		expect(found.every((source) => source.packageName.includes("lanka"))).toBe(true);
	});

	it("skips a lanka package that ships no skills", () => {
		const withoutSkills = createFakeSkillHost({
			json: { "/app/package.json": { dependencies: { "@lankajs/storage": "^1.0.0" } } },
			paths: [],
		});

		expect(findLankaSkillSources({ root: ROOT, host: withoutSkills })).toEqual([]);
	});

	// A package whose manifest cannot be read still has skills worth copying; only
	// the version is unknown, and refusing over it would drop a working skill.
	it("keeps a skill whose package manifest is unreadable", () => {
		const unreadable = createFakeSkillHost({
			json: { "/app/package.json": { dependencies: { lanka: "^1.0.0" } } },
			paths: ["/app/node_modules/lanka/skills"],
			directories: { "/app/node_modules/lanka/skills": ["lanka-core"] },
		});

		expect(findLankaSkillSources({ root: ROOT, host: unreadable })).toEqual([
			{
				packageName: "lanka",
				version: "unknown",
				skill: "lanka-core",
				dir: "/app/node_modules/lanka/skills/lanka-core",
			},
		]);
	});

	it("calls a non-string version unknown rather than passing it on", () => {
		const odd = createFakeSkillHost({
			json: {
				"/app/package.json": { dependencies: { lanka: "^1.0.0" } },
				"/app/node_modules/lanka/package.json": { version: 3 },
			},
			paths: ["/app/node_modules/lanka/skills"],
			directories: { "/app/node_modules/lanka/skills": ["lanka-core"] },
		});

		expect(findLankaSkillSources({ root: ROOT, host: odd })[0].version).toBe("unknown");
	});

	it("ignores a dependency section that is not an object", () => {
		const broken = createFakeSkillHost({
			json: { "/app/package.json": { dependencies: "lanka" } },
		});

		expect(findLankaSkillSources({ root: ROOT, host: broken })).toEqual([]);
	});

	// The layout the old code assumed does not exist here: in a workspace with
	// hoisting the package sits at the repository root, and `apps/web/node_modules`
	// may hold nothing at all. npm, yarn and pnpm all produce this.
	it("finds a package hoisted to a workspace root", () => {
		const hoisted = createFakeSkillHost({
			json: {
				"/repo/apps/web/package.json": { dependencies: { lanka: "^1.0.0" } },
				"/repo/node_modules/lanka/package.json": { version: "2.0.0" },
			},
			packages: { lanka: "/repo/node_modules/lanka" },
			paths: ["/repo/node_modules/lanka/skills"],
			directories: { "/repo/node_modules/lanka/skills": ["lanka-core"] },
		});

		const found = findLankaSkillSources({ root: "/repo/apps/web", host: hoisted });

		expect(found).toEqual([
			{
				packageName: "lanka",
				version: "2.0.0",
				skill: "lanka-core",
				dir: "/repo/node_modules/lanka/skills/lanka-core",
			},
		]);
	});

	// Yarn's Plug'n'Play has no `node_modules` whatsoever. Resolution still
	// answers, because it asks the runtime rather than guessing a path.
	it("finds a package in a project with no node_modules at all", () => {
		const pnp = createFakeSkillHost({
			json: {
				"/app/package.json": { dependencies: { lanka: "^1.0.0" } },
				"/cache/lanka-npm-1.0.0/package.json": { version: "1.0.0" },
			},
			packages: { lanka: "/cache/lanka-npm-1.0.0" },
			paths: ["/cache/lanka-npm-1.0.0/skills"],
			directories: { "/cache/lanka-npm-1.0.0/skills": ["lanka-core"] },
		});

		expect(findLankaSkillSources({ root: ROOT, host: pnp })[0].dir).toBe(
			"/cache/lanka-npm-1.0.0/skills/lanka-core",
		);
	});

	// Resolved, present, and shipping nothing: a lanka package is free not to
	// carry a skill, and that must not stop the ones that do.
	it("skips a package that resolves but ships no skills", () => {
		const bare = createFakeSkillHost({
			json: {
				"/app/package.json": { dependencies: { "@lankajs/storage": "^1.0.0" } },
				"/app/node_modules/@lankajs/storage/package.json": { version: "1.0.0" },
			},
			packages: { "@lankajs/storage": "/app/node_modules/@lankajs/storage" },
			paths: ["/app/node_modules/@lankajs/storage"],
		});

		expect(findLankaSkillSources({ root: ROOT, host: bare })).toEqual([]);
	});

	it("skips a package that is declared and not installed", () => {
		const notInstalled = createFakeSkillHost({
			json: { "/app/package.json": { dependencies: { "@lankajs/storage": "^1.0.0" } } },
		});

		expect(findLankaSkillSources({ root: ROOT, host: notInstalled })).toEqual([]);
	});

	it("answers nothing when the project has no manifest", () => {
		expect(findLankaSkillSources({ root: ROOT, host: createFakeSkillHost() })).toEqual([]);
	});

	// All four fields, because a plugin is usually a dependency, the test kit a
	// devDependency, and core a peer in a library built on top of lanka.
	it("reads peer and optional dependencies too", () => {
		const everywhere = createFakeSkillHost({
			json: {
				"/app/package.json": {
					peerDependencies: { lanka: "^1.0.0" },
					optionalDependencies: { "@lankajs/plugin-sse": "^1.0.0" },
				},
				"/app/node_modules/lanka/package.json": { version: "1.0.0" },
				"/app/node_modules/@lankajs/plugin-sse/package.json": { version: "1.0.0" },
			},
			paths: [
				"/app/node_modules/lanka/skills",
				"/app/node_modules/@lankajs/plugin-sse/skills",
			],
			directories: {
				"/app/node_modules/lanka/skills": ["lanka-core"],
				"/app/node_modules/@lankajs/plugin-sse/skills": ["lanka-sse"],
			},
		});

		expect(findLankaSkillSources({ root: ROOT, host: everywhere }).map((s) => s.skill)).toEqual(
			["lanka-sse", "lanka-core"],
		);
	});
});
