/**
 * One thing wrong with a value, as a hand-written schema reports it.
 *
 * The same two fields Standard Schema carries, and deliberately not more: what
 * comes out of `createLankaSchema` is read by core's port, which turns a path
 * into `ILankaFieldError.path` and a message into the text beside an input.
 *
 * The path is SEGMENTS — `["lines", 0, "sku"]` — never a joined string. A form
 * cannot parse an address back out of one: a message may contain a colon and a
 * key may contain a dot. An index stays a number, because the second element of
 * a list is not a key spelled `"1"`.
 *
 * No path at all means the value AS A WHOLE — a cross-field refusal, or a body
 * that was not the expected shape. That is the form's root, not an input named
 * `""`.
 */
export interface ILankaSchemaIssue {
	readonly message: string;
	readonly path?: readonly (string | number)[];
}
