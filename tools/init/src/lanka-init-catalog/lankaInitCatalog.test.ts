import { describe, expect, it } from "vitest";
import { lankaInitCatalog } from "./lankaInitCatalog";

const axes = [
	["validators", lankaInitCatalog.validators],
	["transports", lankaInitCatalog.transports],
	["storages", lankaInitCatalog.storages],
	["extras", lankaInitCatalog.extras],
] as const;

describe("the catalog", () => {
	it("is frozen all the way down, not only at the top", () => {
		expect(Object.isFrozen(lankaInitCatalog)).toBe(true);
		expect(Object.isFrozen(lankaInitCatalog.templates)).toBe(true);
		expect(Object.isFrozen(lankaInitCatalog.templates[0])).toBe(true);
		// The one `Object.freeze` cannot reach on its own, and the one an importer
		// would otherwise push a package name onto — for every project this tool
		// ever scaffolds in that process.
		expect(Object.isFrozen(lankaInitCatalog.templates[0].packages)).toBe(true);
		expect(Object.isFrozen(lankaInitCatalog.validators[1].packages)).toBe(true);
		expect(Object.isFrozen(lankaInitCatalog.templates[0].defaults)).toBe(true);
	});

	it("pushing to a nested list throws rather than changing every later run", () => {
		expect(() => {
			(lankaInitCatalog.validators[1].packages as string[]).push("not-a-package");
		}).toThrow();
	});

	it.each(axes)("%s have unique ids", (_name, answers) => {
		const ids = answers.map((answer) => answer.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	it("templates have unique ids", () => {
		const ids = lankaInitCatalog.templates.map((template) => template.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	/*
	 * The invariant that would otherwise be found by a consumer: a default naming
	 * an answer that is not there refuses the template the moment it is chosen,
	 * and the message would name an id the person never typed.
	 */
	it("every template's defaults name answers that exist", () => {
		for (const template of lankaInitCatalog.templates) {
			const { validator, transport, storage, extras } = template.defaults;

			expect(lankaInitCatalog.validators.map((one) => one.id)).toContain(validator);
			expect(lankaInitCatalog.transports.map((one) => one.id)).toContain(transport);
			expect(lankaInitCatalog.storages.map((one) => one.id)).toContain(storage);

			for (const extra of extras) {
				expect(lankaInitCatalog.extras.map((one) => one.id)).toContain(extra);
			}
		}
	});

	/*
	 * A default an answer's own runtime forbids would be filtered out of the list
	 * offered and then refused as unknown — the one failure a person could not act
	 * on, because they did not choose it.
	 */
	it("every template's defaults can run where the template runs", () => {
		const byId = new Map(
			[
				...lankaInitCatalog.validators,
				...lankaInitCatalog.transports,
				...lankaInitCatalog.storages,
				...lankaInitCatalog.extras,
			].map((answer) => [`${answer.id}`, answer] as const),
		);

		for (const template of lankaInitCatalog.templates) {
			const { validator, transport, storage, extras } = template.defaults;

			for (const id of [validator, transport, storage, ...extras]) {
				const answer = byId.get(id);

				expect(answer?.runtime.some((one) => template.runtime.includes(one))).toBe(true);
			}
		}
	});

	it.each(axes)("%s name at least one package unless they are `none`", (_name, answers) => {
		for (const answer of answers) {
			const count = answer.packages.length + answer.devPackages.length;

			if (answer.id === "none") expect(count).toBe(0);
			else expect(count).toBeGreaterThan(0);
		}
	});

	it("every lanka package it can install is scoped, so a typo cannot resolve", () => {
		const names = [...lankaInitCatalog.validators, ...lankaInitCatalog.extras]
			.flatMap((answer) => [...answer.packages, ...answer.devPackages])
			.filter((name) => name.includes("lanka"));

		for (const name of names) expect(name.startsWith("@lankajs/")).toBe(true);
	});
});
