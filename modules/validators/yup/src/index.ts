/**
 * @lankajs/yup — the bridge an application that chose yup cannot work without.
 *
 * ## Why this package is not optional, unlike the rest of the family
 *
 * The other packages under `modules/validators/` exist to make a CHOICE visible:
 * core already accepts their libraries' schemas, and the package is a name. This
 * one is different, and the difference is a fact about yup.
 *
 * yup implements Standard Schema — since 1.7.x — but its `~standard.validate` is
 * declared `async` and returns a promise for every schema, valid or not. The
 * framework's validation port is synchronous and refuses a promise loudly, on
 * purpose: answering "fine" to a value it never inspected would let unvalidated
 * data through. So **without this package a yup schema cannot be validated by
 * lanka at all** — every call throws.
 *
 * `lankaYupValidator` goes through `validateSync(value, { abortEarly: false })`,
 * which yup has had all along, and returns exactly what the rest of the family
 * returns: the same two call shapes, paths in segments, messages as
 * `"path: message"`.
 *
 * The bridge is here rather than in core for the same reason the zod 3 bridge is
 * in `@lankajs/zod`: it is knowledge about a specific library and a specific
 * version, and core knows only the protocol.
 */

export { lankaYupValidator } from "./lanka-yup-validator/lankaYupValidator";
export type { TLankaInferred } from "./_types/TLankaInferred";
