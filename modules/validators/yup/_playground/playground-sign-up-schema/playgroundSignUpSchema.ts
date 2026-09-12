import * as yup from "yup";
import type { TLankaInferred } from "../../src/index";

/**
 * A sign-up form's rules, written in yup exactly as a consumer writes them.
 *
 * Nested and repeated shapes on purpose: a flat schema cannot show that failures
 * arrive as field PATHS, which is the only form of error a form can attach to an
 * input. The shape is the family's — every package in `modules/validators/`
 * spells this same schema in its own library, and they are all driven by the one
 * conformance suite.
 */
export const playgroundSignUpSchema = yup.object({
	email: yup.string().email().required(),
	age: yup.number().integer().min(18).required(),
	tags: yup.array(yup.object({ id: yup.number().required() })).required(),
});

/** The type the application uses, inferred through the framework's own port. */
export type TPlaygroundSignUp = TLankaInferred<typeof playgroundSignUpSchema>;
