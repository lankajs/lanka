import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLankaFakeStorageAdapter } from "@lankajs/tool-testing";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetLanka } from "@lankajs/tool-testing/resetLanka";
import { startLanka } from "lanka/bootstrap";

/**
 * The test kit, run by whichever Vitest the calling application installed — and
 * first, which Vitest that is.
 *
 * The kit's suites call `describe` and `it` from `vitest`, and Vitest answers every
 * such import in a run with itself — so they register into the running Vitest
 * even though the kit is workspace source with Vitest 3 beside it. What keeps
 * this honest is the first scene, which asserts the running major, and the
 * conformance suite, whose clauses pass only if they ran.
 */

/** The Vitest the application's own `vitest run` resolves: its root's. */
const runnerVersion = (): string =>
	(
		createRequire(join(process.cwd(), "package.json"))("vitest/package.json") as {
			version: string;
		}
	).version;

export const toolchainScenes = (expectedMajor: string): void => {
	describe(`Vitest ${expectedMajor}: which Vitest this is`, () => {
		it("runs the kit under the installed major", () => {
			expect(runnerVersion().split(".")[0]).toBe(expectedMajor);
		});
	});

	describe(`Vitest ${expectedMajor}: the kit's own helpers`, () => {
		it("hands every reset a fresh framework instance", () => {
			const first = resetLanka();
			const second = resetLanka();

			expect(second).not.toBe(first);
		});

		it("starts lanka against the test host", async () => {
			const lanka = await startLanka({ host: lankaTestHost });

			expect(lanka.isBootstrapped()).toBe(true);
		});
	});

	// A conformance suite from the kit, registering its scenes into THIS runner.
	// Its clauses pass only if they ran; an idle copy of Vitest would register
	// them nowhere and the file would report no tests.
	lankaStorageAdapterConformance({
		vendor: `the kit's fake adapter, under Vitest ${expectedMajor}`,
		create: () => createLankaFakeStorageAdapter(),
		sync: true,
	});
};
