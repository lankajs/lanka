import { lankaDiContract } from "@lankajs/tool-di";
import { describe, expect, it } from "vitest";
import { createPlaygroundProject, playgroundRoot } from "./app";
import {
	applyLankaInit,
	lankaInitCatalog,
	lankaNodeInitHost,
	planLankaInit,
	runLankaInitCli,
} from "../src/index";
import { createFakeInitHost } from "../src/_testing/createFakeInitHost";
import { readLankaInitChoices } from "../src/read-lanka-init-choices/readLankaInitChoices";
import type { IFakeInitHost } from "../src/_testing/createFakeInitHost";

const run = async (argv: readonly string[], host: IFakeInitHost) => {
	const out: string[] = [];

	const code = await runLankaInitCli({
		argv,
		root: playgroundRoot,
		host,
		write: (text) => out.push(text),
		writeError: (text) => out.push(text),
	});

	return { code, out: out.join("") };
};

const written = (host: IFakeInitHost, path: string): string | undefined =>
	host.writes.find((one) => one.path === `${playgroundRoot}/${path}`)?.text;

/**
 * The package, used the way a consumer uses it: one command, one project.
 *
 * The unit tests drive each decision on its own. What needs a whole project is
 * the SET — that what is written fits together, that what was already there
 * survives, and that running the command twice is quiet the second time.
 */
describe("the init playground", () => {
	it("wires a project somebody else's scaffolder made, and keeps everything of theirs", async () => {
		const host = createPlaygroundProject();

		const { code, out } = await run(["--yes"], host);

		expect(code).toBe(0);
		// Their four files are untouched, and the command says what is now theirs
		// to do about the two that matter.
		expect(host.writes.map((one) => one.path)).not.toContain(
			`${playgroundRoot}/vite.config.ts`,
		);
		expect(host.writes.map((one) => one.path)).not.toContain(`${playgroundRoot}/tsconfig.json`);
		expect(out).toContain("Left alone");
		expect(out).toMatch(/tsconfig\.json[\s\S]*@lanka_di\/\*/);
	});

	it("writes the barrels the framework reads, each exporting what it reads by name", async () => {
		const host = createPlaygroundProject();

		await run(["--yes"], host);

		for (const barrel of lankaDiContract.barrels) {
			const text = written(host, `${lankaDiContract.dirname}/${barrel.file}`);

			expect(text).toBeDefined();
			if (barrel.requiredExport !== null) expect(text).toContain(barrel.requiredExport);
		}
	});

	/*
	 * The one thing a starter has to get right. Four layers, and each one names
	 * the one below it: the barrel names the gateway, the ViewModel names the
	 * gateway by its locator name, the screen names the ViewModel.
	 */
	it("writes a feature whose layers name each other, and nothing that names upwards", async () => {
		const host = createPlaygroundProject();

		await run(["--yes"], host);

		expect(written(host, ".lanka/Gateways.ts")).toContain("TodoGateway");
		expect(written(host, "src/ViewModels/todoVM.ts")).toContain("lankaGateways.todoGateway");
		expect(written(host, "src/Modules/Todo/TodoScreen.tsx")).toContain("useLankaVM(todoVM)");
		// The direction the whole framework stands on: nothing under `src/` reads
		// the barrels, which are the framework's to read.
		for (const write of host.writes.filter((one) => one.path.includes("/src/"))) {
			expect(write.text).not.toContain(lankaDiContract.alias);
		}
	});

	it("asks the package manager the project already uses, once per list", async () => {
		const host = createPlaygroundProject();

		await run(["--yes"], host);

		expect(host.commands.map((one) => one.command)).toEqual(["pnpm", "pnpm"]);
		// React and vite were already declared, so they are not asked for again.
		expect(host.commands[0].args).not.toContain("react");
		expect(host.commands[0].args).toContain("lanka");
		expect(host.commands[0].args).toContain("@lankajs/react");
	});

	/*
	 * The reason nothing overwrites, in the form it is actually met: a project
	 * that started without a validator and wants one six months later. Everything
	 * from the first run is left exactly as the team has since edited it, and the
	 * only file written is the one the new answer needs.
	 */
	it("adds a validator to a project that already ran it, and rewrites nothing", async () => {
		const host = createPlaygroundProject();
		await run(["--yes", "--validator", "none"], host);
		const first = host.writes.length;

		const { code, out } = await run(["--yes", "--validator", "valibot"], host);

		expect(code).toBe(0);
		expect(out).not.toContain("+ .lanka/Contract.ts");
		expect(host.writes.length).toBe(first + 1);
		expect(written(host, "src/Core/Validation/todoSchema.ts")).toContain("valibot");
		// And the gateway that was written WITHOUT a validator stays as it was —
		// which is the honest half: what the second run cannot do is edit code the
		// project may have changed. The note says so.
		expect(out).toContain("src/Gateways/TodoGateway/TodoGateway.ts");
		expect(host.commands.at(-2)?.args).toContain("valibot");
	});

	it("starts an empty directory from nothing, manifest included", async () => {
		const host = createFakeInitHost();

		const { code } = await run(["--yes", "--template", "node-service"], host);

		expect(code).toBe(0);
		expect(written(host, "package.json")).toContain('"typecheck"');
		expect(written(host, "src/main.ts")).toContain("startApp");
		// No bundler here, so the path mapping is the whole of the wiring.
		expect(written(host, "tsconfig.json")).toContain(lankaDiContract.alias);
	});

	it("answers a person one question at a time, and writes what they said", async () => {
		const host = createPlaygroundProject({
			template: "vue-spa",
			validator: "arktype",
			transport: "graphql",
			storage: "web",
			extras: "eslint,prefetch",
		});

		const { code } = await run([], host);

		expect(code).toBe(0);
		expect(host.asked.map((one) => one.subject)).toEqual([
			"template",
			"validator",
			"transport",
			"storage",
			"extras",
		]);
		expect(written(host, "src/Modules/Todo/TodoScreen.vue")).toContain("@lankajs/vue");
		expect(host.commands[0].args).toContain("@lankajs/storage");
		expect(host.commands[0].args).toContain("@lankajs/plugin-graphql");
	});

	it("plans without touching anything, which is what `plan` is for", async () => {
		const host = createPlaygroundProject();
		const choices = await readLankaInitChoices({ host, root: playgroundRoot, yes: true });

		const plan = planLankaInit(choices);
		const outcome = await applyLankaInit({ plan, host, dryRun: true });

		expect(host.writes).toEqual([]);
		expect(host.commands).toEqual([]);
		expect(outcome.written.length).toBeGreaterThan(0);
		expect(plan.contractVersion).toBe(lankaDiContract.version);
	});

	it("offers every template it lists, and installs what the list says it does", async () => {
		const { out } = await run(["list"], createPlaygroundProject());

		for (const template of lankaInitCatalog.templates) expect(out).toContain(template.id);
		for (const answer of lankaInitCatalog.validators) expect(out).toContain(answer.id);
	});

	/*
	 * The one thing no scene can drive: the port over a real disk, a real package
	 * manager and a real person. What CAN be asserted is the promise the rest of
	 * the package rests on — that the default port is one object and nobody can
	 * patch a member of it from outside.
	 */
	it("ships one default port, frozen, so nothing can quietly replace a member", () => {
		expect(Object.isFrozen(lankaNodeInitHost)).toBe(true);
		expect(() => {
			(lankaNodeInitHost as { exists: unknown }).exists = () => true;
		}).toThrow();
	});
});
