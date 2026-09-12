import * as v from "valibot";
import type { TLankaInferred } from "../../src/index";

/**
 * The same sign-up rules as `@lankajs/zod`'s playground, in valibot.
 *
 * Deliberately the same shape: the two packages promise interchangeability, and
 * the cheapest way to keep that true is for both playgrounds to answer the same
 * questions.
 */
export const playgroundSignUpSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	age: v.pipe(v.number(), v.integer(), v.minValue(18)),
	tags: v.array(v.object({ id: v.number() })),
});

/** The type the application uses, inferred through the framework's own port. */
export type TPlaygroundSignUp = TLankaInferred<typeof playgroundSignUpSchema>;
