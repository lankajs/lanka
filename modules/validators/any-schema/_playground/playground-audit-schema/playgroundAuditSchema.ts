import * as v from "valibot";

/**
 * An audit log's shape, in valibot.
 *
 * valibot, zod and arktype are all the SAME dialect as far as the port is
 * concerned — a synchronous Standard Schema — so one registration serves all
 * three. That is why the hub's configuration has a `standard` field rather than
 * one field per library.
 */
export const playgroundAuditSchema = v.object({
	actor: v.string(),
	action: v.string(),
});
