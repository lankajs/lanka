import type { Rule } from "eslint";
import { importSourceOf } from "../importSourceOf";

/**
 * Only the framework reads `@lanka_di/*`.
 *
 * The `.lanka_di` barrels are a CONTRACT: the consumer writes them, the framework
 * reads them. It is the only permitted dependency inversion, and it holds because
 * there is exactly one reading side. Once an application imports its own barrels,
 * it has a second route to its own scenarios and gateways — one the framework
 * cannot see, cannot substitute in a test and cannot dispose with the instance.
 *
 * The vite plugin sets the alias in the APPLICATION's config, so technically the
 * import resolves from anywhere. The invariant currently holds by itself, which
 * is exactly why it is worth pinning with a rule rather than with hope: an
 * invariant that holds by itself stops holding silently.
 */
export const lankaDiBarrelsAreFrameworkOnly: Rule.RuleModule = Object.freeze<Rule.RuleModule>({
	meta: {
		type: "problem",
		docs: { description: "forbids an application importing its own `.lanka_di` barrels" },
		schema: [],
		messages: {
			forbidden:
				"`@lanka_di/*` is read by the framework, not by the application. Import your scenarios and gateways directly: a second route to them is invisible to the framework, cannot be substituted in a test and cannot be disposed with the instance.",
		},
	},

	create(context) {
		return {
			ImportDeclaration(node) {
				const source = importSourceOf(node);
				if (source === null || !source.startsWith("@lanka_di/")) return;
				context.report({ node, messageId: "forbidden" });
			},
		};
	},
});
