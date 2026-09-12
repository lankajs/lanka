import { createLankaSchema } from "../../src/index";
import { readPlaygroundFrame } from "../read-playground-frame/readPlaygroundFrame";
import type { IPlaygroundProtocolFrame } from "../_interfaces/IPlaygroundProtocolFrame";

/**
 * A partner's wire protocol, read without a schema library at all.
 *
 * Why not one of the six: this shape is defined by a document, not by the
 * application — the timestamp is seconds since the epoch as a STRING, and a
 * frame older than the epoch is a broken clock rather than a late frame. Written
 * inside a library's escape hatch it would be the same function with a wrapper
 * around it.
 *
 * What comes back is a Standard Schema, so the hub routes it as `standard` and
 * every validator in the family reads it. The application pays nothing for it.
 *
 * The reading itself is its own file because it is used twice — see
 * `playgroundBatchSchema`. That is what composition looks like here.
 */
export const playgroundProtocolSchema = createLankaSchema<IPlaygroundProtocolFrame>(
	(data, issue) => readPlaygroundFrame(data, issue),
	"acme-protocol",
);
