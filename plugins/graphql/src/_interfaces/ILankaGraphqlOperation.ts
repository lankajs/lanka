/**
 * A document plus what it needs, as this package accepts it.
 *
 * `document` is `unknown` rather than `string`, and that is the whole point: a
 * code generator answers a `TypedDocumentNode`, and demanding a string would
 * make every call site write `print(doc)` or `doc.loc.source.body`. Both forms
 * are read by `lankaGraphqlDocument`, which is the only place either is touched
 * — this package never parses GraphQL.
 */
export interface ILankaGraphqlOperation {
	/** The query, mutation or subscription: a string, or a generated document node. */
	document: unknown;
	/** The variables the document declares. */
	variables?: Record<string, unknown>;
	/** Which operation to run, when the document holds several. */
	operationName?: string;
}
