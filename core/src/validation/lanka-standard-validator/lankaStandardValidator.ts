import type { StandardSchemaV1 } from "@standard-schema/spec";
import { LankaValidationError } from "../lanka-validation-error/LankaValidationError";
import type { TLankaValidationResult } from "../_types/TLankaValidationResult";
import type { ILankaFieldError } from "../../errors/_interfaces/ILankaFieldError";

/**
 * Response body validation with any Standard Schema implementation.
 *
 * An abstraction typed by one library cannot be implemented by another, which is
 * the whole reason a validation port exists. Standard Schema is the shared
 * interface implemented by zod 4, valibot, arktype and others.
 *
 * `@standard-schema/spec` contains TYPES ONLY and adds no bytes to a build, so it
 * is a regular dependency rather than another peer.
 *
 * No adapter classes: a schema describes itself, and
 * `schema["~standard"].validate(data)` is the whole protocol.
 */

/** A schema the port understands: any Standard Schema implementation. */
export type TLankaSchema<TOutput = unknown> = StandardSchemaV1<unknown, TOutput>;

export interface ILankaValidator {
	/** Validates and returns the parsed value, or throws. */
	validate<TOutput>(schema: TLankaSchema<TOutput>, data: unknown, context: string): TOutput;
	/** Validates and returns an outcome, throwing nothing. */
	validateSafe<TOutput>(
		schema: TLankaSchema<TOutput>,
		data: unknown,
	): TLankaValidationResult<TOutput>;
}

/**
 * An issue's path as segments: `["items", 0, "id"]`.
 *
 * Standard Schema allows a segment to be a key or an object carrying one; a
 * form addresses by the key. Numbers stay numbers — an index is not a name —
 * and anything else becomes the string a form library expects.
 *
 * A LOOP rather than `.map`, and neither is a style choice.
 *
 * `.map` preserves an Array SUBCLASS — arktype returns a `ReadonlyPath` carrying
 * a cache of stringified ancestors — so the library's internal came back attached
 * to a path this port promises is segments. It printed identically to a plain
 * array and compared unequal, which is the worst shape a wrong answer can take.
 *
 * `Array.from(path, fn)` fixes that and costs: measured on the zod bench's
 * refusal row, twice each, it took the path from 56 yardsticks to 87-92 — a
 * 1.6x regression on the row a form hits on every keystroke before the last one.
 * Pushing into a literal is both correct and free: 53-55 yardsticks, at or under
 * where the path started. Correctness did not have to be paid for here, and a
 * comment saying "`Array.from` for correctness" would have hidden that it was.
 */
function readIssuePath(issue: StandardSchemaV1.Issue): (string | number)[] {
	const segments: (string | number)[] = [];

	for (const segment of issue.path ?? []) {
		const key =
			typeof segment === "object" && segment !== null && "key" in segment
				? segment.key
				: segment;

		segments.push(typeof key === "number" ? key : String(key));
	}

	return segments;
}

/**
 * A field path plus a message, for a banner.
 *
 * The path is assembled WHOLE — `items.0.id`, not `id`. Without the index and the
 * parent the message points nowhere when the list has twenty items.
 */
function describeIssue(issue: StandardSchemaV1.Issue): string {
	const path = readIssuePath(issue).join(".");

	return path ? `${path}: ${issue.message}` : issue.message;
}

/** The same issue for a form: the path kept in segments, the message beside it. */
function toFieldError(issue: StandardSchemaV1.Issue): ILankaFieldError {
	return { path: readIssuePath(issue), message: issue.message };
}

/**
 * Whether the value speaks the protocol at all.
 *
 * A schema may be a FUNCTION — arktype's is callable, with `~standard` on its
 * prototype — so the guard asks for the marker and nothing else. The
 * specification says what a schema CARRIES, never what it is made of, and a
 * guard reading `typeof schema === "object"` refuses arktype while the port
 * claims to accept it.
 */
function isStandardSchema(schema: unknown): boolean {
	if (schema === null || schema === undefined) return false;

	return (typeof schema === "object" || typeof schema === "function") && "~standard" in schema;
}

function runSync<TOutput>(
	schema: TLankaSchema<TOutput>,
	data: unknown,
): StandardSchemaV1.Result<TOutput> {
	// An application whose schemas come from two libraries eventually hands one to
	// the wrong validator. Unguarded, that read `undefined.validate` and produced
	// "Cannot read properties of undefined" — an error naming neither the schema,
	// nor the port, nor what to do about it.
	//
	// It throws from `validateSafe` too, deliberately: a refused VALUE is an
	// outcome a form renders, while a schema the port cannot read is a wiring
	// mistake, and putting it in `errors` would show a programmer's error to a
	// user beside an input.
	if (!isStandardSchema(schema)) {
		throw new LankaValidationError(
			"This is not a Standard Schema: the value has no `~standard` property. " +
				"Either it is not a schema at all, or it belongs to a library that " +
				"needs its own package from `modules/validators/` — yup, TypeBox and " +
				"Effect each do.",
			[],
		);
	}

	const result = schema["~standard"].validate(data);

	// Standard Schema allows returning a promise. A synchronous port cannot await
	// it, and answering "fine" would let UNVALIDATED data through — a check that
	// cannot fail reporting success.
	if (result instanceof Promise) {
		throw new LankaValidationError(
			"The schema is asynchronous and the validation port is synchronous. Parse " +
				"such data by hand: passing it silently would be worse than failing. " +
				// The commonest cause by a distance, and the one where "parse it by
				// hand" is the wrong advice: yup implements Standard Schema with an
				// `async validate`, so EVERY yup schema lands here. Naming it turns a
				// dead end into an install.
				"If this is a yup schema, every one of them is asynchronous — use " +
				"`@lankajs/yup`, which validates them synchronously.",
			[],
		);
	}

	return result;
}

export const lankaStandardValidator: ILankaValidator = Object.freeze<ILankaValidator>({
	validate<TOutput>(schema: TLankaSchema<TOutput>, data: unknown, context: string): TOutput {
		const result = runSync(schema, data);

		if (result.issues) {
			throw new LankaValidationError(
				`Validation failed for ${context}`,
				result.issues.map(describeIssue),
				result.issues.map(toFieldError),
			);
		}

		return result.value;
	},

	validateSafe<TOutput>(
		schema: TLankaSchema<TOutput>,
		data: unknown,
	): TLankaValidationResult<TOutput> {
		const result = runSync(schema, data);

		if (result.issues) {
			return {
				success: false,
				errors: result.issues.map(describeIssue),
				fields: result.issues.map(toFieldError),
			};
		}

		return { success: true, data: result.value };
	},
});
