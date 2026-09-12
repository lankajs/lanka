/**
 * How a hand-written schema reads a value: the body of `createLankaSchema`.
 *
 * Called with whatever the caller passed — which is `unknown` and means it: a
 * gateway hands the port what the wire produced, and that includes `null`, a
 * bare array and a string where an object was promised.
 *
 * `issue` may be called as many times as there are problems, and returns
 * `undefined` so `return issue(...)` reads as the early exit it is. The value
 * returned is used ONLY when nothing was reported, which is what lets a reader
 * collect several problems and still end with a single `return`.
 */
export type TLankaSchemaReader<TOutput> = (
	data: unknown,
	issue: (message: string, path?: readonly (string | number)[]) => void,
) => TOutput;
