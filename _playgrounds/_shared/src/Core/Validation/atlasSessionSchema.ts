import { object, string } from "yup";

/**
 * The session, written in **yup** — a dialect of its own.
 *
 * Its Standard Schema is `async`, and a synchronous port cannot await one. That
 * is why `@lankajs/yup` exists and why "four dialects, not six libraries" is a
 * real distinction rather than bookkeeping: this schema cannot go through the
 * `standard` validator, and a hub that tried would either block or answer
 * "fine" for data nothing had checked.
 */
export const atlasSessionSchema = object({
	token: string().required(),
	refreshToken: string().required(),
	csrf: string().required(),
	name: string().required(),
});
