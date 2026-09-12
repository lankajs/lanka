import { Type } from "@sinclair/typebox";

/**
 * A vendored billing SDK's shape, and the SDK is written in TypeBox.
 *
 * The commonest way an application ends up with two schema libraries: it did not
 * choose the second one. Rewriting a third party's schemas into your library is
 * a migration you maintain forever, and the alternative is this package.
 */
export const playgroundBillingSchema = Type.Object({
	invoice: Type.String(),
	amountCents: Type.Integer({ minimum: 0 }),
	currency: Type.Union([Type.Literal("EUR"), Type.Literal("USD")]),
});
