import type { Rule } from "eslint";
import { importSourceOf } from "../importSourceOf";
import { isInsideAny } from "../isInsideAny";
import { isTypeOnlyImport } from "../isTypeOnlyImport";
import { toPosix } from "../toPosix";

interface IOptions {
	/** What a gateway import looks like. `@Gateways/…` by default. */
	gatewayPattern?: string;
	/** Who may reach a gateway. Only `ViewModels` by default. */
	allowedDirs?: readonly string[];
	/**
	 * What a gateway's DECLARATIONS look like — its schemas, its error classes,
	 * its response types — as a pattern over the import source, e.g.
	 * `"/(Validation|Errors)/"`. Importing one of those is not a call: a
	 * component checking `error instanceof GapNotFoundError` or a bridge parsing
	 * an SSE payload with the gateway's schema owns no request. No default: the
	 * folder names are the consumer's.
	 */
	declarationPattern?: string;
}

/**
 * A gateway is called only from a ViewModel.
 *
 * ## Why
 *
 * A gateway is the only place with I/O. A component reaching one directly takes
 * on what a ViewModel IS: loading state, failure handling, cancellation on
 * leaving the screen. None of the three appears in the component — they simply
 * vanish, and it is invisible while the network is fast.
 *
 * ## What is NOT a call
 *
 * A type-only import, and an import of the gateway's declarations when the
 * consumer names them (`declarationPattern`). Both are erased or inert at run
 * time; reporting them made the first consumer's 240 findings 240 non-requests,
 * and a rule read as noise is a rule switched off.
 *
 * ## Why the folder list is configuration
 *
 * Applications have different trees. The rule inspects a CONSUMER, and a folder
 * list baked into the package would mean the rule works for exactly one of them.
 */
export const lankaGatewaysOnlyInViewModels: Rule.RuleModule = Object.freeze<Rule.RuleModule>({
	meta: {
		type: "problem",
		docs: { description: "forbids reaching gateways outside a ViewModel" },
		schema: [
			{
				type: "object",
				properties: {
					gatewayPattern: { type: "string" },
					allowedDirs: { type: "array", items: { type: "string" } },
					declarationPattern: { type: "string" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			outside:
				"A gateway is called from a ViewModel. From here it leaves the screen without loading state, failure handling and cancellation on leaving — visible only on a slow connection.",
		},
	},

	create(context) {
		const options = (context.options[0] ?? {}) as IOptions;
		const pattern = new RegExp(options.gatewayPattern ?? "^@Gateways/");
		const declaration =
			options.declarationPattern === undefined
				? null
				: new RegExp(options.declarationPattern);
		const allowedDirs = options.allowedDirs ?? ["ViewModels"];
		const filename = toPosix(context.filename);

		if (isInsideAny(filename, allowedDirs)) return {};

		return {
			ImportDeclaration(node) {
				const source = importSourceOf(node);
				if (source === null || !pattern.test(source)) return;
				if (isTypeOnlyImport(node)) return;
				if (declaration?.test(source)) return;
				context.report({ node, messageId: "outside" });
			},
		};
	},
});
