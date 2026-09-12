import type { TLankaSchema } from "lanka/validation";
import type { ILankaSchemaIssue } from "../../_interfaces/ILankaSchemaIssue";
import type { TLankaSchemaReader } from "../../_types/TLankaSchemaReader";

/**
 * A schema written in lanka's own dialect, and therefore in nobody's.
 *
 * ## What this is for
 *
 * A schema library is the right answer almost always — it gives composition,
 * inference, and rules somebody else has already got wrong and fixed. Three
 * cases where it is not:
 *
 * - **One shape, in a package that should not gain a dependency.** A plugin
 *   validating its own config does not get to pick the application's library.
 * - **A rule no library spells.** A cross-field check reaching a service, a
 *   format defined by a protocol document. Written as an escape hatch inside a
 *   library's schema, it is the part of the schema the library does not help
 *   with anyway.
 * - **Before a library is chosen.** A prototype that validates its bodies is
 *   better than one that does not, and this costs nothing to delete later.
 *
 * It is NOT a library, and it will not become one. There is no `string()`, no
 * `object()`, no composition. Wanting those is the signal to install one of the
 * six packages in `modules/validators/`, and the guide says so.
 *
 * ## Why it works everywhere in lanka
 *
 * What comes back is a Standard Schema — `~standard`, synchronous — so it is the
 * `standard` dialect and every validator in the family already accepts it, the
 * hub included. Core's `lankaStandardValidator` accepts it with no package at
 * all.
 *
 * ```ts
 * const orderSchema = createLankaSchema<IOrder>((data, issue) => {
 * 	if (!isRecord(data)) return issue("expected an object");
 *
 * 	if (typeof data.id !== "string") issue("must be a string", ["id"]);
 * 	if (typeof data.total !== "number") issue("must be a number", ["total"]);
 *
 * 	return data as IOrder;
 * });
 * ```
 *
 * `issue` returns `undefined`, so `return issue(...)` reads as the early exit it
 * is. The value the reader returns is used only when no issue was raised — which
 * is what lets a reader report several problems and still end with one `return`.
 */
export const createLankaSchema = <TOutput>(
	read: TLankaSchemaReader<TOutput>,
	vendor = "lanka",
): TLankaSchema<TOutput> => ({
	"~standard": {
		version: 1,
		vendor,
		validate: (data: unknown) => {
			// A fresh list per call, declared inside `validate` rather than beside the
			// schema. A collector shared between calls is a schema that remembers the
			// last body it refused, and the bug surfaces as an unrelated request
			// failing under load.
			const issues: ILankaSchemaIssue[] = [];

			const value = read(data, (message, path) => {
				issues.push({ message, path });
			});

			// The value is IGNORED when anything was reported, so a reader may collect
			// several problems and still end with a single `return`. Trusting the
			// value instead would let a half-built object through beside its errors.
			if (issues.length > 0) return { issues };

			return { value };
		},
	},
});
