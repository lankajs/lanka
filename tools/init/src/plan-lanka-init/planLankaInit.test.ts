import { lankaDiContract } from "@lankajs/tool-di";
import { lankaInitCatalog } from "../lanka-init-catalog/lankaInitCatalog";
import { describe, expect, it } from "vitest";
import { createFakeInitHost } from "../_testing/createFakeInitHost";
import { planLankaInit } from "./planLankaInit";
import { readLankaInitChoices } from "../read-lanka-init-choices/readLankaInitChoices";
import type { IReadLankaInitChoicesOptions } from "../read-lanka-init-choices/readLankaInitChoices";

const plan = async (given: Partial<IReadLankaInitChoicesOptions> = {}) =>
	planLankaInit(
		await readLankaInitChoices({
			host: createFakeInitHost(),
			root: "/app",
			yes: true,
			...given,
		}),
	);

const names = (one: Awaited<ReturnType<typeof plan>>, dev: boolean): readonly string[] =>
	one.dependencies
		.filter((dependency) => dependency.dev === dev)
		.map((dependency) => dependency.name);

const paths = (one: Awaited<ReturnType<typeof plan>>): readonly string[] =>
	one.files.map((file) => file.path);

describe("planning", () => {
	it("names core and its one peer, whatever the template", async () => {
		for (const template of ["react-spa", "node-service", "expo-native"]) {
			const one = await plan({ template });

			// `zustand` is core's peer, and only npm installs a missing peer: under
			// pnpm it is a warning at install and a resolution error at build.
			expect(names(one, false)).toContain("lanka");
			expect(names(one, false)).toContain("zustand");
			expect(names(one, true)).toContain("@lankajs/tool-di");
		}
	});

	it("adds the validator's package and its library together", async () => {
		const one = await plan({ validator: "valibot" });

		expect(names(one, false)).toContain("@lankajs/valibot");
		expect(names(one, false)).toContain("valibot");
		expect(names(one, false)).not.toContain("zod");
	});

	it("writes no schema file when nothing validates", async () => {
		const one = await plan({ validator: "none" });

		expect(paths(one)).not.toContain("src/Core/Validation/todoSchema.ts");
		expect(names(one, false)).not.toContain("zod");
	});

	it("writes every barrel the contract declares, and no more", async () => {
		const one = await plan();
		const barrels = paths(one).filter((path) => path.startsWith(`${lankaDiContract.dirname}/`));

		expect(barrels).toEqual(
			lankaDiContract.barrels.map((barrel) => `${lankaDiContract.dirname}/${barrel.file}`),
		);
	});

	it("records the contract version the barrels were written for", async () => {
		expect((await plan()).contractVersion).toBe(lankaDiContract.version);
	});

	/*
	 * jsdom is not the test kit's to declare: `environment: "jsdom"` is a line in
	 * the config THIS command writes, and only for a template that renders into a
	 * browser.
	 */
	it("adds a DOM for the test run only when there is a browser and a test run", async () => {
		expect(names(await plan({ template: "react-spa" }), true)).toContain("jsdom");
		expect(names(await plan({ template: "node-service" }), true)).not.toContain("jsdom");
		expect(names(await plan({ template: "react-spa", extras: [] }), true)).not.toContain(
			"jsdom",
		);
	});

	it("gives a browser template a vite config and a device template a metro one", async () => {
		expect(paths(await plan({ template: "react-spa" }))).toContain("vite.config.ts");
		expect(paths(await plan({ template: "expo-native" }))).toContain("metro.config.js");
		expect(paths(await plan({ template: "next-app" }))).toContain("next.config.mjs");
		expect(paths(await plan({ template: "nuxt-app" }))).toContain("nuxt.config.ts");
	});

	/*
	 * Nothing scaffolds the barrels on a build here and nothing installs the
	 * alias, which is why the `paths` mapping is the whole of the wiring — and why
	 * `tsconfig.json` is the one file this template cannot do without.
	 */
	it("gives a template with no bundler no bundler config at all", async () => {
		const one = await plan({ template: "node-service" });

		expect(paths(one)).not.toContain("vite.config.ts");
		expect(paths(one)).not.toContain("metro.config.js");
		expect(paths(one)).not.toContain("next.config.mjs");
		expect(paths(one)).toContain("tsconfig.json");
	});

	it("writes the rules only when the rules were taken", async () => {
		expect(paths(await plan({ extras: ["eslint"] }))).toContain("eslint.config.mjs");
		expect(paths(await plan({ extras: [] }))).not.toContain("eslint.config.mjs");
		expect(paths(await plan({ extras: [] }))).not.toContain("vitest.config.ts");
	});

	it("writes one screen, in the language the binding reads", async () => {
		expect(paths(await plan({ template: "vue-spa" }))).toContain(
			"src/Modules/Todo/TodoScreen.vue",
		);
		expect(paths(await plan({ template: "svelte-spa" }))).toContain(
			"src/Modules/Todo/TodoScreen.svelte",
		);
		expect(paths(await plan({ template: "vanilla-spa" }))).toContain(
			"src/Modules/Todo/mountTodoScreen.ts",
		);
		expect(paths(await plan({ template: "node-service" }))).toContain("src/main.ts");
	});

	it("says what is left to do, naming the guide of everything it installed", async () => {
		const one = await plan({ validator: "zod", transport: "http", extras: ["prefetch"] });
		const subjects = one.notes.map((note) => note.subject);

		expect(subjects).toContain("zod");
		expect(subjects).toContain("http");
		expect(subjects).toContain("prefetch");
		expect(subjects).toContain("@lankajs/tool-di");
	});

	/*
	 * Every template, because a table is only checked by the row nobody reads. A
	 * template whose build has no config writer, or whose framework has no screen,
	 * plans a project missing the one file it cannot run without — and nothing
	 * else here would say so.
	 */
	it.each(lankaInitCatalog.templates.map((template) => template.id))(
		"%s plans a project with a tsconfig, a screen and a feature",
		async (id) => {
			const one = await plan({ template: id });

			expect(paths(one)).toContain("tsconfig.json");
			expect(paths(one)).toContain("package.json");
			expect(paths(one)).toContain("src/startApp.ts");
			expect(paths(one).filter((path) => /Modules|main\.ts/.test(path))).toHaveLength(1);
			expect(one.files.every((file) => file.text.endsWith("\n"))).toBe(true);
		},
	);

	it("reads no disk: a plan is the same whatever is already there", async () => {
		const host = createFakeInitHost({ files: { "/app/tsconfig.json": "{}" } });
		const choices = await readLankaInitChoices({ host, root: "/app", yes: true });

		expect(paths(planLankaInit(choices))).toContain("tsconfig.json");
	});
});
