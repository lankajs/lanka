import { z } from "zod";
import type { TLankaInferred } from "../../src/index";

/**
 * A sign-up form's rules, written in zod exactly as a consumer writes them.
 *
 * Nested and repeated shapes on purpose: a flat schema cannot show that failures
 * arrive as field PATHS, which is the only form of error a form can attach to an
 * input.
 */
export const playgroundSignUpSchema = z.object({
	email: z.string().email(),
	age: z.number().int().min(18),
	tags: z.array(z.object({ id: z.number() })),
});

/** The type the application uses, inferred through the framework's own port. */
export type TPlaygroundSignUp = TLankaInferred<typeof playgroundSignUpSchema>;
