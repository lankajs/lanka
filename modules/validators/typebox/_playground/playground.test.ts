import { describe, expect, it } from "vitest";
import { lankaValidatorConformance } from "@lankajs/tool-testing/lankaValidatorConformance";
import { lankaTypeBoxValidator } from "../src/index";
import {
	createPlaygroundOrderList,
	playgroundApiShapeSchema,
	playgroundSignUpSchema,
	playgroundToApiSchema,
} from "./app";

/**
 * The package, used as an application uses it.
 *
 * What matters is not that TypeBox validates — TypeBox's own tests cover that —
 * but that a TypeBox schema passes through the framework's validator port
 * intact, and that a failure arrives as something a form can put next to an
 * input.
 *
 * Those assertions are the family's, so they are imported rather than written
 * here: six packages promising the same thing in six copies of one test file is
 * six chances for one of them to quietly stop promising it.
 */
lankaValidatorConformance({
	vendor: "TypeBox",
	validator: lankaTypeBoxValidator,
	signUp: playgroundSignUpSchema,
	apiShape: playgroundApiShapeSchema,
	toApi: playgroundToApiSchema,
});

describe("the TypeBox playground's list screen", () => {
	const page = [
		{ sku: "A-1", qty: 2 },
		{ sku: "A-2", qty: 1 },
	];

	it("reads a page of rows against one compiled checker", () => {
		expect(createPlaygroundOrderList().read(page).rows).toEqual(page);
	});

	it("keeps the rows it could read and refuses only the row that broke", () => {
		// The decision the file exists to show: a page of twenty with one bad row
		// renders nineteen rows and one message. A schema over the whole array
		// renders an empty screen.
		const state = createPlaygroundOrderList().read([page[0], { sku: "A-2", qty: 0 }, page[1]]);

		expect(state.rows).toEqual([page[0], page[1]]);
		expect(state.refused).toHaveLength(1);
	});

	it("addresses a refused row by its INDEX in the page", () => {
		const state = createPlaygroundOrderList().read([page[0], { sku: 7, qty: 1 }]);

		expect(state.refused[0]).toMatch(/^1: /);
	});

	it("starts each read empty, so a good page clears the last one's messages", () => {
		const list = createPlaygroundOrderList();

		list.read([{ sku: "A-2", qty: 0 }]);
		list.read(page);

		expect(list.state.refused).toEqual([]);
	});

	it("reads an empty page as an empty screen, not as a failure", () => {
		const state = createPlaygroundOrderList().read([]);

		expect(state.rows).toEqual([]);
		expect(state.refused).toEqual([]);
	});
});
