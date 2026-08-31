import { describe, expect, it } from "vitest";
import { getLankaFlags } from "lanka/config";
import { runLankaStatic } from "./runLankaStatic";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

const build = { host: lankaTestHost };

describe("runLankaStatic", () => {
	it("runs build-time work against its own instance", async () => {
		const slugs = await runLankaStatic(build, (lanka) => {
			expect(lanka.isBootstrapped()).toBe(true);
			return ["first-post", "second-post"];
		});

		expect(slugs).toEqual(["first-post", "second-post"]);
	});

	it("resolves the ambient facades inside the build scope", async () => {
		await runLankaStatic({ ...build, flags: { isMockMode: true } }, () => {
			expect(getLankaFlags().isMockMode).toBe(true);
		});
	});

	it("installs no request middleware of its own", async () => {
		// Nothing to forward: there is no caller. An empty chain is the observable
		// difference between the two modes.
		await runLankaStatic(build, (lanka) => {
			expect(lanka.requestMiddleware).toHaveLength(0);
		});
	});

	// The failure worth refusing outright: output written once and served to
	// everybody must not carry one reader's identity. The types forbid it;
	// JavaScript callers have no types.
	it("REFUSES headers, so a build cannot bake in one reader's session", async () => {
		await expect(
			// @ts-expect-error identity may not cross into output served to everybody.
			// This comment is the type-level half of the test: if the call ever
			// compiles, `tsc` fails on an unused `@ts-expect-error`.
			runLankaStatic({ ...build, headers: { cookie: "session=abc" } }, () => undefined),
		).rejects.toThrow(/served to everybody/);
	});

	it("does not mistake an explicitly absent header bag for one", async () => {
		await expect(runLankaStatic({ ...build, headers: undefined }, () => "fine")).resolves.toBe(
			"fine",
		);
	});

	it("disposes the instance even when the build step throws", async () => {
		await expect(
			runLankaStatic(build, () => {
				throw new Error("the prerender failed");
			}),
		).rejects.toThrow("the prerender failed");
	});
});
