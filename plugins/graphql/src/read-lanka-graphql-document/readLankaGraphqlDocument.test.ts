import { describe, expect, it } from "vitest";
import { readLankaGraphqlDocument } from "./readLankaGraphqlDocument";

/**
 * The one place either form of a document is touched.
 *
 * The package never parses GraphQL, so this is the whole of its knowledge about
 * documents — and every branch here is a form some code generator actually
 * produces.
 */
describe("readLankaGraphqlDocument", () => {
	it("takes a template literal as written", () => {
		expect(readLankaGraphqlDocument(`query Todos { todos { id } }`)).toBe(
			`query Todos { todos { id } }`,
		);
	});

	it("reads the source a generator attached to a document node", () => {
		const generated = { kind: "Document", loc: { source: { body: `query Todos { id }` } } };

		expect(readLankaGraphqlDocument(generated)).toBe(`query Todos { id }`);
	});

	it("prints anything that knows how to print itself", () => {
		// Several client libraries hand out an object whose `toString` is the
		// document, and refusing it would send the caller looking for `print`.
		const printable = { toString: () => `query Todos { id }` };

		expect(readLankaGraphqlDocument(printable)).toBe(`query Todos { id }`);
	});

	it("refuses an object that prints as nothing useful", () => {
		// A body with no query comes back as a server error about syntax, which
		// sends the reader looking at the backend for a mistake made here.
		expect(() => readLankaGraphqlDocument({ notADocument: true })).toThrow(TypeError);
	});

	it("refuses a value that is not a document at all", () => {
		expect(() => readLankaGraphqlDocument(undefined)).toThrow(/undefined/);
		expect(() => readLankaGraphqlDocument(null)).toThrow(TypeError);
	});
});
