import { type } from "arktype";
import type { TLankaInferred } from "../../src/index";

/**
 * A sign-up form's rules, written in arktype exactly as a consumer writes them.
 *
 * Nested and repeated shapes on purpose: a flat schema cannot show that failures
 * arrive as field PATHS, which is the only form of error a form can attach to an
 * input. The shape is the family's — every package in `modules/validators/`
 * spells this same schema in its own library, and they are all driven by the one
 * conformance suite.
 */
export const playgroundSignUpSchema = type({
	email: "string.email",
	age: "number.integer >= 18",
	tags: type({ id: "number" }).array(),
});

/** The type the application uses, inferred through the framework's own port. */
export type TPlaygroundSignUp = TLankaInferred<typeof playgroundSignUpSchema>;
