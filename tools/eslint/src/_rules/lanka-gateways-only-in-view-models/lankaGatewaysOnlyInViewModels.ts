import type { Rule } from "eslint";
import { importSourceOf } from "../importSourceOf";
import { isInsideAny } from "../isInsideAny";
import { toPosix } from "../toPosix";

interface IOptions {
	/** What a gateway import looks like. `@Gateways/…` by default. */
	gatewayPattern?: string;
	/** Who may reach a gateway. Only `ViewModels` by default. */
	allowedDirs?: readonly string[];
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
		const allowedDirs = options.allowedDirs ?? ["ViewModels"];
		const filename = toPosix(context.filename);

		if (isInsideAny(filename, allowedDirs)) return {};

		return {
			ImportDeclaration(node) {
				const source = importSourceOf(node);
				if (source === null || !pattern.test(source)) return;
				context.report({ node, messageId: "outside" });
			},
		};
	},
});
