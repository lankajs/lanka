import { Type } from "@sinclair/typebox";
import type { TLankaInferred } from "../../src/index";

/**
 * A sign-up form's rules, written in TypeBox exactly as a consumer writes them.
 *
 * At MODULE level, which is not a style choice here: the compiled checker is
 * cached by the schema object's identity, and a schema rebuilt per render is a
 * new key every time.
 *
 * Nested and repeated shapes on purpose: a flat schema cannot show that failures
 * arrive as field PATHS, which is the only form of error a form can attach to an
 * input.
 */
export const playgroundSignUpSchema = Type.Object({
	// A pattern rather than `format: "email"`. TypeBox keeps formats in a registry
	// the application fills, and an unregistered one comes back as "Unknown
	// format" — a rule that looks present in the schema and checks nothing.
	email: Type.String({ pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }),
	age: Type.Integer({ minimum: 18 }),
	tags: Type.Array(Type.Object({ id: Type.Number() })),
});

/** The type the application uses, inferred through the framework's own port. */
export type TPlaygroundSignUp = TLankaInferred<typeof playgroundSignUpSchema>;
