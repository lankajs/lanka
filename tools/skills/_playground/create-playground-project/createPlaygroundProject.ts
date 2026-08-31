import { createFakeSkillHost } from "../../src/_testing/createFakeSkillHost";
import type { IFakeSkillHost } from "../../src/_testing/createFakeSkillHost";

/**
 * A project as a real one looks: core, a plugin, the test kit, and React.
 *
 * Written as data rather than assembled per scene, because what the scenes prove
 * is about the SET — that a consumer gets the skills of what they installed and
 * nothing else, and that a second run over the same project is quiet.
 */
export const createPlaygroundProject = (): IFakeSkillHost =>
	createFakeSkillHost({
		json: {
			"/app/package.json": {
				dependencies: {
					lanka: "^1.0.0",
					"@lankajs/plugin-http": "^1.0.0",
					react: "^19.0.0",
				},
				devDependencies: { "@lankajs/tool-testing": "^1.0.0", vitest: "^3.0.0" },
			},
			"/app/node_modules/lanka/package.json": { version: "1.4.0" },
			"/app/node_modules/@lankajs/plugin-http/package.json": { version: "1.4.0" },
			"/app/node_modules/@lankajs/tool-testing/package.json": { version: "1.4.0" },
		},
		paths: [
			"/app/node_modules/lanka/skills",
			"/app/node_modules/@lankajs/plugin-http/skills",
			"/app/node_modules/@lankajs/tool-testing/skills",
		],
		directories: {
			"/app/node_modules/lanka/skills": ["lanka-core", "lanka-packages"],
			"/app/node_modules/@lankajs/plugin-http/skills": ["lanka-http"],
			"/app/node_modules/@lankajs/tool-testing/skills": ["lanka-testing"],
		},
	});
