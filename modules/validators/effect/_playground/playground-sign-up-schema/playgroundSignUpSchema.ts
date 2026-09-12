import { Schema } from "effect";
import type { TLankaInferred } from "../../src/index";

/**
 * A sign-up form's rules, written in Effect Schema exactly as a consumer writes
 * them.
 *
 * At MODULE level, which is not a style choice here: the Standard Schema wrapper
 * is cached by the schema object's identity, and a schema rebuilt per render is a
 * new key every time.
 *
 * Nested and repeated shapes on purpose: a flat schema cannot show that failures
 * arrive as field PATHS, which is the only form of error a form can attach to an
 * input.
 */
export const playgroundSignUpSchema = Schema.Struct({
	email: Schema.String.pipe(Schema.pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)),
	age: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(18)),
	tags: Schema.Array(Schema.Struct({ id: Schema.Number })),
});

/** The type the application uses, inferred through the framework's own port. */
export type TPlaygroundSignUp = TLankaInferred<typeof playgroundSignUpSchema>;
