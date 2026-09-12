import * as yup from "yup";

/**
 * A screen that predates the rest of the application, still on yup.
 *
 * The second commonest way: the schemas were written before the library was
 * chosen, and rewriting them is a week nobody has. Note that this one would not
 * work through core's port at all — every yup schema's Standard Schema is
 * asynchronous — so the hub routing it to `@lankajs/yup` is the whole reason the
 * screen still runs.
 */
export const playgroundProfileSchema = yup.object({
	handle: yup.string().required(),
	age: yup.number().integer().min(18).required(),
});
