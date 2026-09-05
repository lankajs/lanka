import type { Rule } from "eslint";
import { importSourceOf } from "../importSourceOf";
import { isInsideAny } from "../isInsideAny";
import { isTypeOnlyImport } from "../is-type-only-import/isTypeOnlyImport";
import { toPosix } from "../toPosix";

interface IOptions {
	/** What a ViewModel import looks like. `@ViewModels/…` by default. */
	viewModelPattern?: string;
	/** Where ViewModels live. `ViewModels` by default. */
	viewModelDirs?: readonly string[];
	/**
	 * The shared stores — the third rung of the ladder, by folder name, e.g.
	 * `["SessionViewModel"]`. A ViewModel may import one of these: it is the one
	 * state several screens co-edit on purpose, and the rule's own message points
	 * at it. Naming them here keeps the list short and visible; without the
	 * option the first consumer had to switch the rule off for the two files
	 * that read the session, which is the whole rule lost for two lines.
	 */
	sharedStores?: readonly string[];
}

/**
 * A ViewModel does not import another ViewModel.
 *
 * ## Why
 *
 * A ViewModel owns state. Two of them wired directly own it together: whichever
 * writes last wins, the second re-renders for reasons its own screen cannot
 * explain, and neither can be reset without thinking about the other.
 *
 * The connection is real, and the framework already has a name for it. A
 * scenario carries the FACT between them — "a todo was completed" — and each
 * side decides what that means for its own state. Which is why this rule can be
 * this blunt: nothing is being taken away.
 *
 * ## The ladder
 *
 * One owner ViewModel; a scenario when another must react; a shared store only
 * when several must co-edit one state and scenarios have turned into
 * synchronisation. `core/README.md` carries it with the reasons. The third rung
 * is what `sharedStores` names — and a type-only import is not on the ladder at
 * all, since it owns nothing.
 */
export const lankaNoViewModelToViewModel: Rule.RuleModule = Object.freeze<Rule.RuleModule>({
	meta: {
		type: "problem",
		docs: { description: "forbids importing one ViewModel from another" },
		schema: [
			{
				type: "object",
				properties: {
					viewModelPattern: { type: "string" },
					viewModelDirs: { type: "array", items: { type: "string" } },
					sharedStores: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		messages: {
			coupled:
				"A ViewModel imports another ViewModel. Two owners of one state: use a scenario to carry the fact, or a shared store when they must co-edit it.",
		},
	},

	create(context) {
		const options = (context.options[0] ?? {}) as IOptions;
		const pattern = new RegExp(options.viewModelPattern ?? "^@ViewModels/");
		const viewModelDirs = options.viewModelDirs ?? ["ViewModels"];
		const sharedStores = options.sharedStores ?? [];
		const filename = toPosix(context.filename);

		if (!isInsideAny(filename, viewModelDirs)) return {};

		const isSharedStore = (source: string): boolean =>
			source.split("/").some((segment) => sharedStores.includes(segment));

		return {
			ImportDeclaration(node) {
				const source = importSourceOf(node);
				if (source === null || !pattern.test(source)) return;
				if (isTypeOnlyImport(node)) return;
				if (isSharedStore(source)) return;
				context.report({ node, messageId: "coupled" });
			},
		};
	},
});
