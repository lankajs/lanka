import { Type } from "@sinclair/typebox";

/**
 * One row of a list screen, at MODULE level.
 *
 * The placement is the lesson: the compiled checker is cached by this object's
 * identity, so a schema built inside a component body is compiled again on every
 * render. The package's bench measures both rows, and the gap is 41x.
 */
export const playgroundRowSchema = Type.Object({
	sku: Type.String(),
	qty: Type.Integer({ minimum: 1 }),
});
