import type { Rule } from "eslint";

/** How one role may be written in this project. */
type TLayerStyle = "class" | "functional" | "both";

/** A role the framework ships, or one the project declared itself. */
interface IRoleForms {
	/** Bases whose subclassing IS the class style. */
	extend?: readonly string[];
	/** Classes whose construction IS the class style — a role with no base to extend. */
	construct?: readonly string[];
	/** Factories whose call IS the functional style. */
	factory?: readonly string[];
}

/** What a project declares for a role of its own. */
interface IDeclaredRole {
	base?: string;
	construct?: string;
	factory?: string;
	style?: TLayerStyle;
}

interface IOptions extends Record<string, unknown> {
	roles?: Record<string, IDeclaredRole>;
}

/**
 * The roles the framework ships, and the two forms each is written in.
 *
 * A plugin and a bootstrap step are absent on purpose: their functional style is
 * an object literal satisfying `ILankaPlugin` / `ILankaBootstrapStep`, and
 * recognising one without type information means guessing from property names.
 * A rule that guesses reports a style nobody chose. A project that wants those
 * two pinned declares them under `roles` with a factory of its own.
 */
const FRAMEWORK_ROLES: Record<string, IRoleForms> = {
	gateway: { extend: ["ALankaGateway"], factory: ["createLankaGateway"] },
	viewmodel: {
		extend: ["ALankaVM"],
		factory: [
			"createLankaVM",
			"createLazyLankaVM",
			"createStatelessLankaVM",
			"createLazyStatelessLankaVM",
			"createSharedStoreLankaVM",
			"createLazySharedStoreLankaVM",
		],
	},
	scenario: { extend: ["ALankaScenario"], factory: ["createLankaScenario"] },
	"shared-store": { extend: ["ALankaSharedStore"], factory: ["createLankaSharedStore"] },
	singleton: { extend: ["ALankaSingleton"], factory: ["createLankaSingleton"] },
	"sse-bridge": { extend: ["ALankaSseBridge"], factory: ["createLankaSseBridge"] },
	request: {
		construct: ["LankaFetchJsonRequest", "LankaFetchRequest", "LankaFetchFormDataRequest"],
		factory: [
			"createLankaFetchJsonRequest",
			"createLankaFetchRequest",
			"createLankaFetchFormDataRequest",
		],
	},
};

/** The name a class extends, when that is a plain identifier. */
const superClassNameOf = (node: Rule.Node): string | null => {
	const declaration = node as unknown as { superClass?: { type: string; name: string } };
	const superClass = declaration.superClass;
	if (!superClass || superClass.type !== "Identifier") return null;

	return superClass.name;
};

/** The name being called or constructed, when that is a plain identifier. */
const calleeNameOf = (node: Rule.Node): string | null => {
	const call = node as unknown as { callee?: { type: string; name: string } };
	if (!call.callee || call.callee.type !== "Identifier") return null;

	return call.callee.name;
};

/** What a project pinned: which identifier belongs to which role, in which style. */
interface ILayerPolicy {
	classForms: Map<string, string>;
	functionalForms: Map<string, string>;
	styles: Map<string, TLayerStyle>;
}

/**
 * Reads the options into the three lookups the visitors need.
 *
 * A role left at `both` is not recorded at all: an empty `styles` is how the rule
 * says "this project made no choice", and it then visits nothing.
 */
const readPolicy = (options: IOptions): ILayerPolicy => {
	const policy: ILayerPolicy = {
		classForms: new Map(),
		functionalForms: new Map(),
		styles: new Map(),
	};

	const remember = (role: string, forms: IRoleForms, style: TLayerStyle): void => {
		if (style === "both") return;

		policy.styles.set(role, style);
		for (const name of forms.extend ?? []) policy.classForms.set(name, role);
		for (const name of forms.construct ?? []) policy.classForms.set(name, role);
		for (const name of forms.factory ?? []) policy.functionalForms.set(name, role);
	};

	for (const [role, forms] of Object.entries(FRAMEWORK_ROLES)) {
		remember(role, forms, (options[role] as TLayerStyle | undefined) ?? "both");
	}

	for (const [role, declared] of Object.entries(options.roles ?? {})) {
		remember(
			role,
			{
				extend: declared.base ? [declared.base] : [],
				construct: declared.construct ? [declared.construct] : [],
				factory: declared.factory ? [declared.factory] : [],
			},
			declared.style ?? "both",
		);
	}

	return policy;
};

/**
 * A project writes each layer in ONE style, and says which.
 *
 * ## Why a rule rather than a review
 *
 * Both applications this framework grew out of picked a style per layer and held
 * it — gateways as classes, ViewModels as factories, in both, without either team
 * writing it down. What is not written down is argued about in review, once per
 * new hire.
 *
 * The framework has no opinion about WHICH: it ships both forms of every role
 * deliberately (`skills/parity/SKILL.md`), so this rule reports only the style a
 * PROJECT excluded. An unlisted role is `both`, which is also the default for the
 * whole rule — switching it on changes nothing until a choice is made.
 *
 * ```js
 * "lanka/layer-style": ["error", {
 * 	gateway: "class",
 * 	viewmodel: "functional",
 * 	roles: {
 * 		repository: { base: "ARepository", factory: "createRepository", style: "functional" },
 * 	},
 * }]
 * ```
 *
 * ## What it reads
 *
 * The construction form, not the file path: `extends ALankaGateway` is the class
 * style, `createLankaGateway(` is the functional one. A project's own role names
 * its own pair and gets the same treatment — which is the point of publishing
 * `defineLankaRole`.
 */
export const lankaLayerStyle: Rule.RuleModule = Object.freeze<Rule.RuleModule>({
	meta: {
		type: "suggestion",
		docs: { description: "keeps each layer in the one style a project chose" },
		schema: [
			{
				type: "object",
				properties: {
					...Object.fromEntries(
						Object.keys(FRAMEWORK_ROLES).map((role) => [
							role,
							{ enum: ["class", "functional", "both"] },
						]),
					),
					roles: {
						type: "object",
						additionalProperties: {
							type: "object",
							properties: {
								base: { type: "string" },
								construct: { type: "string" },
								factory: { type: "string" },
								style: { enum: ["class", "functional", "both"] },
							},
							additionalProperties: false,
						},
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			classExcluded:
				'This project writes a {{role}} in the functional style: "{{name}}" is the class form. Both exist in the framework; the choice is the project\'s.',
			functionalExcluded:
				'This project writes a {{role}} as a class: "{{name}}" is the functional form. Both exist in the framework; the choice is the project\'s.',
		},
	},

	create(context) {
		const { classForms, functionalForms, styles } = readPolicy(
			(context.options[0] ?? {}) as IOptions,
		);

		// Nothing was pinned: the rule is on and has nothing to say, which is the
		// state a framework must not break a project from.
		if (styles.size === 0) return {};

		/** Reports one form, when the role it belongs to excluded that form. */
		const report = (node: Rule.Node, name: string | null, form: TLayerStyle): void => {
			const forms = form === "class" ? classForms : functionalForms;
			const role = name === null ? undefined : forms.get(name);
			if (role === undefined || styles.get(role) === form) return;

			context.report({
				node,
				messageId: form === "class" ? "classExcluded" : "functionalExcluded",
				data: { role, name: name ?? "" },
			});
		};

		const onClass = (node: Rule.Node): void => {
			report(node, superClassNameOf(node), "class");
		};

		return {
			ClassDeclaration: onClass,
			ClassExpression: onClass,

			NewExpression(node) {
				report(node, calleeNameOf(node), "class");
			},

			CallExpression(node) {
				report(node, calleeNameOf(node), "functional");
			},
		};
	},
});
