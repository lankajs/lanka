import { type } from "arktype";

/**
 * The crew, written in **arktype** — the third library of the `standard` dialect.
 *
 * Three libraries, one dialect, one validator reading all three. That is the
 * fact `@lankajs/any-schema`'s guide leads with, and a repository that only ever
 * used one library could assert it nowhere.
 */
export const atlasCrewSchema = type({
	id: "string > 0",
	name: "string > 0",
	avatarUrl: "string > 0",
});
