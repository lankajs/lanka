import type { Rule } from "eslint";
import { importSourceOf } from "../importSourceOf";
import { isInsideAny } from "../isInsideAny";
import { toPosix } from "../toPosix";

interface IOptions {
	/** What a gateway import looks like. `@Gateways/…` by default. */
	gatewayPattern?: string;
	/** Where gateways live. `Gateways` by default. */
	gatewayDirs?: readonly string[];
}

/**
 * A gateway does not import another gateway.
 *
 * ## Why
 *
 * A gateway is one endpoint's worth of I/O and nothing else. The moment one
 * calls another, a request chain exists that no screen owns: no loading state
 * belongs to it, no failure has a place to be shown, and cancelling the screen
 * cancels the first call while the second is already on the wire.
 *
 * The composition it stands in for belongs one layer up — a ViewModel calls two
 * gateways, and the order, the failure and the cancellation are visible there.
 *
 * ## What it does NOT forbid
 *
 * Sharing a transport, a request class or a base gateway. Those are not one
 * gateway reaching another; they are the layer below both.
 */
export const lankaNoGatewayToGateway: Rule.RuleModule = Object.freeze<Rule.RuleModule>({
	meta: {
		type: "problem",
		docs: { description: "forbids importing one gateway from another" },
		schema: [
			{
				type: "object",
				properties: {
					gatewayPattern: { type: "string" },
					gatewayDirs: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		messages: {
			chained:
				"A gateway imports another gateway. The chain that makes belongs to a ViewModel: from here nobody owns its loading state, its failure or its cancellation.",
		},
	},

	create(context) {
		const options = (context.options[0] ?? {}) as IOptions;
		const pattern = new RegExp(options.gatewayPattern ?? "^@Gateways/");
		const gatewayDirs = options.gatewayDirs ?? ["Gateways"];
		const filename = toPosix(context.filename);

		if (!isInsideAny(filename, gatewayDirs)) return {};

		return {
			ImportDeclaration(node) {
				const source = importSourceOf(node);
				if (source === null || !pattern.test(source)) return;
				context.report({ node, messageId: "chained" });
			},
		};
	},
});
