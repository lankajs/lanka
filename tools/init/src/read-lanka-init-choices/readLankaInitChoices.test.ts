import { describe, expect, it } from "vitest";
import { createFakeInitHost } from "../_testing/createFakeInitHost";
import { readLankaInitChoices } from "./readLankaInitChoices";
import type { IFakeInitHostState } from "../_testing/createFakeInitHost";
import type { IReadLankaInitChoicesOptions } from "./readLankaInitChoices";

const read = (
	given: Partial<IReadLankaInitChoicesOptions> = {},
	state: IFakeInitHostState = {},
) => {
	const host = createFakeInitHost(state);

	return { host, choices: readLankaInitChoices({ host, root: "/app", ...given }) };
};

describe("reading the choices", () => {
	it("takes the template's own defaults when nobody can be asked", async () => {
		const { choices, host } = read();

		expect((await choices).template.id).toBe("react-spa");
		expect((await choices).validator.id).toBe("zod");
		expect((await choices).transport.id).toBe("http");
		expect((await choices).extras.map((one) => one.id)).toEqual([
			"eslint",
			"testing",
			"devtools",
		]);
		// The port answered `null` for every one of them, which is what a pipe and
		// a CI runner both do.
		expect(host.asked).toHaveLength(5);
	});

	it("asks nothing at all with --yes", async () => {
		const { choices, host } = read({ yes: true });

		expect((await choices).template.id).toBe("react-spa");
		expect(host.asked).toEqual([]);
	});

	it("a flag beats a question, and a question beats the default", async () => {
		const { choices, host } = read(
			{ validator: "valibot" },
			{ answers: { template: "vue-spa", transport: "graphql" } },
		);

		expect((await choices).template.id).toBe("vue-spa");
		expect((await choices).validator.id).toBe("valibot");
		expect((await choices).transport.id).toBe("graphql");
		// The one that was typed was never asked about.
		expect(host.asked.map((one) => one.subject)).not.toContain("validator");
	});

	it("an empty reply is the default, because Enter means Enter", async () => {
		const { choices } = read({}, { answers: { template: "", validator: "" } });

		expect((await choices).template.id).toBe("react-spa");
		expect((await choices).validator.id).toBe("zod");
	});

	it("refuses an id it does not know, by name and with the list", async () => {
		await expect(read({ validator: "joi" }).choices).rejects.toThrow(
			/unknown validator "joi"[\s\S]*zod/,
		);
	});

	it("refuses an unknown template the same way", async () => {
		await expect(read({ template: "ember-spa" }).choices).rejects.toThrow(
			/unknown template "ember-spa"/,
		);
	});

	/*
	 * The filter is not cosmetic. An answer a template cannot run is an answer
	 * whose failure arrives at build time, in a package the person did not know
	 * they had asked for.
	 */
	it("never offers an answer this template cannot run", async () => {
		const { choices, host } = read({}, { answers: { template: "react-spa" } });
		await choices;

		const storage = host.asked.find((one) => one.subject === "storage");
		const extras = host.asked.find((one) => one.subject === "extras");

		expect(storage?.answers.map((one) => one.id)).not.toContain("mmkv");
		expect(extras?.answers.map((one) => one.id)).toContain("devtools");
	});

	it("offers a device the device answers, and not the browser ones", async () => {
		const { choices, host } = read({ template: "expo-native" });
		await choices;

		const storage = host.asked.find((one) => one.subject === "storage");
		const extras = host.asked.find((one) => one.subject === "extras");

		expect(storage?.answers.map((one) => one.id)).toContain("mmkv");
		expect(extras?.answers.map((one) => one.id)).not.toContain("devtools");
	});

	it("refuses an answer that exists but cannot run here", async () => {
		await expect(read({ template: "react-spa", storage: "mmkv" }).choices).rejects.toThrow(
			/unknown storage "mmkv"/,
		);
	});

	it("reads several extras from one reply, and drops what it does not know", async () => {
		const { choices } = read({ extras: ["testing", "prefetch"] });

		expect((await choices).extras.map((one) => one.id)).toEqual(["testing", "prefetch"]);
	});

	it("splits a typed reply on commas and keeps catalog order", async () => {
		const { choices } = read({}, { answers: { extras: "prefetch, testing" } });

		expect((await choices).extras.map((one) => one.id)).toEqual(["testing", "prefetch"]);
	});

	it("an empty extras reply means none, not the default", async () => {
		const { choices } = read({}, { answers: { extras: "" } });

		expect((await choices).extras).toEqual([]);
	});

	it("carries the base URL and the root through untouched", async () => {
		const { choices } = read({ apiBaseUrl: "https://api.example.com", root: "/srv/app" });

		expect((await choices).apiBaseUrl).toBe("https://api.example.com");
		expect((await choices).root).toBe("/srv/app");
	});
});
