/**
 * What to say when a validator is handed a schema from another library.
 *
 * ## Why this is not three sentences in three packages
 *
 * `@lankajs/yup`, `@lankajs/typebox` and `@lankajs/effect` each refuse a schema
 * they do not own, and each has to answer the same follow-up: is this a schema at
 * all, and if so whose? The answer is identical in all three because the
 * SITUATION is identical — only the lead differs, because only the marker each
 * looked for differs.
 *
 * Written three times it was three copies, and `check:composition` said so. Made
 * deliberately different to satisfy the gate it would have been worse: three
 * wordings of one fact, and a consumer who met two of them would be entitled to
 * think they meant different things.
 *
 * ## Why `lanka/internal` and not the facade
 *
 * This tier exists for exactly this: "a sibling package needs these and must not
 * reach into another package's `src/`". It promises nothing beyond a patch, which
 * is the right promise for a sentence.
 *
 * A facade `isStandardSchema` was proposed first and refused, for a reason worth
 * keeping: it would answer `true` for every yup schema, and `lankaStandardValidator`
 * throws on every yup schema. A consumer writing `if (isStandardSchema(s))
 * validate(s, …)` would have written the exact bug the family works to prevent,
 * and the name would have told them it was safe.
 */
export const lankaForeignSchemaMessage = (schema: unknown, { lead }: { lead: string }): string => {
	// Object OR function: arktype's schema is callable, with `~standard` on its
	// prototype, and a check reading only objects would tell an arktype user
	// their schema is not a schema.
	const indexable =
		schema !== null && (typeof schema === "object" || typeof schema === "function");

	if (indexable && "~standard" in schema) {
		return (
			`${lead} It does carry \`~standard\`, so it belongs to another library in ` +
			"`modules/validators/` — validate it with that package's validator, or with " +
			"`lankaStandardValidator`."
		);
	}

	return (
		`${lead} Either it is not a schema at all, or it belongs to a library with its ` +
		"own package in `modules/validators/`."
	);
};
