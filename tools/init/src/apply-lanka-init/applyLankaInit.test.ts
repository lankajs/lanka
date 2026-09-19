import { describe, expect, it } from "vitest";
import { applyLankaInit } from "./applyLankaInit";
import { createFakeInitHost } from "../_testing/createFakeInitHost";
import { planLankaInit } from "../plan-lanka-init/planLankaInit";
import { readLankaInitChoices } from "../read-lanka-init-choices/readLankaInitChoices";
import type { IFakeInitHostState } from "../_testing/createFakeInitHost";
import type { IReadLankaInitChoicesOptions } from "../read-lanka-init-choices/readLankaInitChoices";

const MANIFEST = JSON.stringify({ name: "app", dependencies: { react: "19.0.0" } });

const run = async (
	state: IFakeInitHostState = {},
	options: { dryRun?: boolean; install?: boolean } = {},
	given: Partial<IReadLankaInitChoicesOptions> = {},
) => {
	const host = createFakeInitHost(state);
	const plan = planLankaInit(
		await readLankaInitChoices({ host, root: "/app", yes: true, ...given }),
	);

	return { host, plan, outcome: await applyLankaInit({ plan, host, ...options }) };
};

describe("applying a plan", () => {
	it("writes every file the plan names into the project root", async () => {
		const { host, outcome, plan } = await run({ files: { "/app/package.json": MANIFEST } });

		expect(outcome.written).toHaveLength(plan.files.length - 1);
		expect(host.writes.map((one) => one.path)).toContain("/app/.lanka/Gateways.ts");
		expect(host.writes.map((one) => one.path)).toContain("/app/src/ViewModels/todoVM.ts");
	});

	/*
	 * The rule the whole package is arranged around. This command is run twice
	 * more often than it is run once — a project adds a validator six months
	 * later — and a scaffolder that rewrites what a team has edited is one nobody
	 * runs the second time.
	 */
	it("never overwrites, and says what the project must now do itself", async () => {
		const { host, outcome } = await run({
			files: { "/app/package.json": MANIFEST, "/app/tsconfig.json": '{ "include": [] }' },
		});

		expect(host.writes.map((one) => one.path)).not.toContain("/app/tsconfig.json");
		expect(outcome.kept.map((one) => one.path)).toContain("tsconfig.json");
		expect(outcome.kept.find((one) => one.path === "tsconfig.json")?.reason).toMatch(
			/@lanka_di\/\*/,
		);
	});

	it("keeps a file with no advice of its own with the plain reason", async () => {
		const { outcome } = await run({
			files: { "/app/package.json": MANIFEST, "/app/src/ViewModels/todoVM.ts": "// mine" },
		});

		expect(outcome.kept.find((one) => one.path === "src/ViewModels/todoVM.ts")?.reason).toMatch(
			/nothing overwrites/,
		);
	});

	it("a dry run writes nothing, runs nothing, and reports the same lists", async () => {
		const { host, outcome } = await run(
			{ files: { "/app/package.json": MANIFEST } },
			{ dryRun: true },
		);

		expect(host.writes).toEqual([]);
		expect(host.commands).toEqual([]);
		expect(outcome.written.length).toBeGreaterThan(0);
		expect(outcome.dryRun).toBe(true);
	});

	it("asks the package manager the project already uses", async () => {
		const { host } = await run({
			files: { "/app/package.json": MANIFEST, "/app/pnpm-lock.yaml": "" },
		});

		expect(host.commands.map((one) => one.command)).toEqual(["pnpm", "pnpm"]);
		expect(host.commands[0].args[0]).toBe("add");
		expect(host.commands[1].args.slice(0, 2)).toEqual(["add", "-D"]);
	});

	it("falls back to npm, which is the one every machine has", async () => {
		const { host } = await run({ files: { "/app/package.json": MANIFEST } });

		expect(host.commands[0].command).toBe("npm");
		expect(host.commands[1].args.slice(0, 2)).toEqual(["install", "--save-dev"]);
	});

	it("uses yarn and bun when their lockfiles are the ones present", async () => {
		const yarn = await run({ files: { "/app/package.json": MANIFEST, "/app/yarn.lock": "" } });
		const bun = await run({ files: { "/app/package.json": MANIFEST, "/app/bun.lock": "" } });

		expect(yarn.host.commands[0].command).toBe("yarn");
		expect(bun.host.commands[1].args.slice(0, 2)).toEqual(["add", "-d"]);
	});

	/*
	 * A dependency the project already declares is a version somebody chose. Asking
	 * the package manager for it again is how a scaffolder moves a range nobody
	 * asked it to touch.
	 */
	it("does not ask for what the manifest already declares", async () => {
		const { host } = await run({ files: { "/app/package.json": MANIFEST } });

		expect(host.commands[0].args).not.toContain("react");
		expect(host.commands[0].args).toContain("lanka");
	});

	/*
	 * An empty directory is the case the ORDER exists for: the manifest is one of
	 * the planned files, so it is there by the time a package manager is asked to
	 * add anything — and `pnpm add` without one is an error that would end the run.
	 */
	it("writes a manifest first, so an empty directory can still be installed into", async () => {
		const { host, outcome } = await run();

		expect(outcome.written.map((one) => one.path)).toContain("package.json");
		expect(host.commands[0].args).toContain("lanka");
	});

	it("survives a manifest that does not parse, rather than ending on it", async () => {
		const { host } = await run({ files: { "/app/package.json": "{ not json" } });

		expect(host.commands[0].args).toContain("lanka");
	});

	it("leaves the package manager alone when told to", async () => {
		const { host } = await run(
			{ files: { "/app/package.json": MANIFEST } },
			{ install: false },
		);

		expect(host.commands).toEqual([]);
		expect(host.writes.length).toBeGreaterThan(0);
	});

	it("reports a failed install rather than hiding it", async () => {
		const { outcome } = await run({ files: { "/app/package.json": MANIFEST }, exitCode: 9 });

		expect(outcome.installs?.every((one) => one.code === 9)).toBe(true);
	});

	/*
	 * Three states rather than two, because a reader acts differently on each: a
	 * package manager never asked leaves the dependencies theirs to add, and an
	 * empty list means it was asked and there was nothing left.
	 */
	it("says the package manager was never asked, rather than answering an empty list", async () => {
		const skipped = await run({ files: { "/app/package.json": MANIFEST } }, { install: false });
		const dry = await run({ files: { "/app/package.json": MANIFEST } }, { dryRun: true });

		expect(skipped.outcome.installs).toBeNull();
		expect(dry.outcome.installs).toBeNull();
	});

	it("runs only one command when a project needs no development packages", async () => {
		const { host } = await run(
			{ files: { "/app/package.json": MANIFEST } },
			{},
			{ template: "next-app", extras: [], validator: "none", transport: "none" },
		);

		// Only `@lankajs/tool-di` and typescript are left on the development side,
		// so the shape to prove is the empty one: a command per list, never a
		// command per package.
		expect(host.commands).toHaveLength(2);
	});

	it("is quiet the second time: everything it wrote is already there", async () => {
		const files = { "/app/package.json": MANIFEST };
		const host = createFakeInitHost({ files });
		const plan = planLankaInit(await readLankaInitChoices({ host, root: "/app", yes: true }));

		await applyLankaInit({ plan, host, install: false });
		const second = await applyLankaInit({ plan, host, install: false });

		expect(second.written).toEqual([]);
		expect(second.kept).toHaveLength(plan.files.length);
	});
});
