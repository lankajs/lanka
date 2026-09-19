import { describe, expect, it } from "vitest";
import { createFakeInitHost } from "../_testing/createFakeInitHost";
import { describeLankaInitOutcome } from "./describeLankaInitOutcome";
import { planLankaInit } from "../plan-lanka-init/planLankaInit";
import { readLankaInitChoices } from "../read-lanka-init-choices/readLankaInitChoices";
import type { ILankaInitOutcome } from "../_interfaces/ILankaInitOutcome";

const aPlan = async () =>
	planLankaInit(
		await readLankaInitChoices({ host: createFakeInitHost(), root: "/app", yes: true }),
	);

const outcome = (given: Partial<ILankaInitOutcome> = {}): ILankaInitOutcome => ({
	written: [{ path: "tsconfig.json", gist: "the path mapping" }],
	kept: [],
	installs: [],
	notes: [],
	dryRun: false,
	...given,
});

describe("describing a run", () => {
	it("says `would` for a run that has not happened and the past tense for one that has", async () => {
		const plan = await aPlan();

		expect(describeLankaInitOutcome(plan, outcome({ dryRun: true }))).toContain("Would write");
		expect(describeLankaInitOutcome(plan, outcome())).toContain("Wrote");
	});

	/*
	 * The second run's ordinary answer, and it has to be said out loud: silence
	 * where an install was expected reads as an install that failed.
	 */
	it("says so when there was nothing left to install", async () => {
		expect(describeLankaInitOutcome(await aPlan(), outcome())).toContain(
			"Nothing left to install",
		);
	});

	it("says nothing about installing during a dry run, because nothing would have", async () => {
		expect(
			describeLankaInitOutcome(await aPlan(), outcome({ dryRun: true, installs: null })),
		).not.toContain("install");
	});

	it("names the flag when the package manager was never asked", async () => {
		expect(describeLankaInitOutcome(await aPlan(), outcome({ installs: null }))).toContain(
			"--no-install",
		);
	});

	it("names the dependencies without a version, because the range is not this tool's", async () => {
		const text = describeLankaInitOutcome(await aPlan(), outcome());

		expect(text).toContain("lanka");
		expect(text).not.toMatch(/lanka@|\^\d/);
	});

	it("shows what was kept, and the reason beside it", async () => {
		const text = describeLankaInitOutcome(
			await aPlan(),
			outcome({ kept: [{ path: "vite.config.ts", reason: "add the plugin yourself" }] }),
		);

		expect(text).toContain("Left alone");
		expect(text).toContain("add the plugin yourself");
	});

	it("says what was taken, and `nothing else` when nothing was", async () => {
		const plan = planLankaInit(
			await readLankaInitChoices({
				host: createFakeInitHost(),
				root: "/app",
				yes: true,
				validator: "none",
				transport: "none",
				storage: "none",
				extras: [],
			}),
		);

		expect(describeLankaInitOutcome(plan, outcome())).toContain("nothing else taken");
	});

	it("reports a failed install with the code the package manager answered", async () => {
		const text = describeLankaInitOutcome(
			await aPlan(),
			outcome({ installs: [{ command: "pnpm", args: ["add", "lanka"], code: 3 }] }),
		);

		expect(text).toContain("FAILED, exit code 3");
	});
});
