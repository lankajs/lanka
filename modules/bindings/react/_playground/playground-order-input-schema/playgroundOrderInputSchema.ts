import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

/**
 * What a person may submit, described by hand.
 *
 * ONE schema, three readers: the ViewModel that holds the inputs itself checks
 * with it, the form stand-in uses it as its resolver, and the gateway checks the
 * payload against it before sending. That is the whole bridge between lanka and
 * a form library — the validation port speaks Standard Schema, and so do React
 * Hook Form and TanStack Form — and it is visible only when a schema implements
 * the protocol directly, without zod or valibot in the way.
 *
 * Every issue carries its path in segments: `["items", 1, "qty"]`, so the
 * message lands on the second line's quantity, not on "items".
 */
// Typed with the input it is FOR, not `unknown`: React Hook Form and TanStack
// Form both read the schema's input type as the form's, while the validation
// port accepts any input type — so one declaration serves all three readers.
export const playgroundOrderInputSchema: StandardSchemaV1<
	IPlaygroundOrderInput,
	IPlaygroundOrderInput
> = {
	"~standard": {
		version: 1,
		vendor: "playground",
		validate: (value) => {
			if (typeof value !== "object" || value === null) {
				return { issues: [{ message: "expected an order", path: [] }] };
			}

			const input = value as Partial<IPlaygroundOrderInput>;
			const issues: StandardSchemaV1.Issue[] = [];

			if (typeof input.customer !== "string" || input.customer.trim().length === 0) {
				issues.push({ message: "a customer is required", path: ["customer"] });
			}

			if (!Array.isArray(input.items)) {
				issues.push({ message: "items must be a list", path: ["items"] });
			} else {
				input.items.forEach((item, index) => {
					if (!Number.isInteger(item.qty) || item.qty < 1) {
						issues.push({ message: "at least one", path: ["items", index, "qty"] });
					}
				});
			}

			return issues.length > 0 ? { issues } : { value: input as IPlaygroundOrderInput };
		},
	},
};
