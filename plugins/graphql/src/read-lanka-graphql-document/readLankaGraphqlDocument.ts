const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/**
 * The document as text, from whichever form the caller had.
 *
 * Three forms reach this package and all three are ordinary:
 *
 * - a template literal, which is already text;
 * - a `TypedDocumentNode` from a code generator, which carries the source it was
 *   parsed from at `loc.source.body`;
 * - anything else whose `toString` answers the document, which is what several
 *   client libraries hand out.
 *
 * The alternative — accepting only a string — pushes `print(doc)` onto every
 * call site, and `print` means shipping a GraphQL parser to redo work a
 * build-time generator already did.
 *
 * Throws rather than sending an empty operation: a request whose body carries no
 * query comes back as a server error about syntax, which sends the reader
 * looking at the backend for a mistake made here.
 */
export const readLankaGraphqlDocument = (document: unknown): string => {
	if (typeof document === "string") return document;

	if (isRecord(document)) {
		const source = (document.loc as { source?: { body?: unknown } } | undefined)?.source?.body;
		if (typeof source === "string") return source;

		// An OWN `toString` is the invitation to print; the inherited one answers
		// `[object Object]`, which is not a document and must not be sent as one.
		// Asked by identity rather than by comparing the output: a document that
		// genuinely printed that string is not a document either, and the check
		// should say what it means.
		const printer: unknown = (document as { toString?: unknown }).toString;
		if (typeof printer === "function" && printer !== Object.prototype.toString) {
			const printed: unknown = (printer as () => unknown).call(document);
			if (typeof printed === "string" && printed.length > 0) return printed;
		}
	}

	throw new TypeError(
		`A GraphQL document must be a string, a generated document node, or something that prints as one. Received: ${typeof document}`,
	);
};
