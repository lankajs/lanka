/**
 * A resource's address in a read cache: `["order", 7]`, never a joined string.
 *
 * Strings, numbers and booleans only — deliberately narrower than `unknown[]`.
 * `@nanostores/query` accepts `string | number | true` as a key part and cannot
 * carry an object at all, so a wider type here would be a promise the port
 * cannot keep on every implementation. An application that wants to key by a
 * filter object states its parts: `["orders", status, page]`.
 *
 * Two structurally equal keys are the same key. Segments are ordered, so
 * `["order", 1]` and `[1, "order"]` are two resources.
 */
export type TLankaCacheKey = readonly (string | number | boolean)[];
