import type { Rule } from "eslint";
import { toPosix } from "../toPosix";
import { importSourceOf } from "../importSourceOf";

interface IOptions {
	/** Top-layer folders. `Modules` and `App` by default. */
	upperDirs?: readonly string[];
}

/**
 * Nothing below the top layer may reach into it.
 *
 * ## Why this boundary
 *
 * `Core` is what everything depends on: a single `Core → Modules` import makes
 * EVERY consumer of `Core`, other modules included, depend on one specific
 * module. After that the module can no longer be reasoned about, tested or
 * deleted on its own.
 *
 * ## A rule rather than a test
 *
 * As a test it lives in the consumer, in as many copies as there are consumers,
 * and a framework whose main promise is verified by copies of someone else's
 * script does not verify it at all.
 */
export const lankaNoUpwardImports: Rule.RuleModule = Object.freeze<Rule.RuleModule>({
	meta: {
		type: "problem",
		docs: {
			description: "forbids importing from the top layer below it",
		},
		schema: [
			{
				type: "object",
				properties: {
					upperDirs: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		messages: {
			upward: '"{{dir}}" is the top layer and is invisible from below. One such import makes every consumer of this file depend on one module: it can no longer be reasoned about or deleted on its own.',
		},
	},

	create(context) {
		const options = (context.options[0] ?? {}) as IOptions;
		const upperDirs = options.upperDirs ?? ["Modules", "App"];
		const filename = toPosix(context.filename);

		// The file is ITSELF in the top layer, so it may: Modules and App are the
		// only ones that know about Modules and App.
		const isUpper = upperDirs.some((dir) => filename.includes(`/${dir}/`));
		if (isUpper) return {};

		const mentions = (source: string, dir: string): boolean =>
			source.startsWith(`@${dir}/`) ||
			source.startsWith(`${dir}/`) ||
			source.includes(`/${dir}/`);

		return {
			ImportDeclaration(node) {
				const source = importSourceOf(node);
				if (source === null) return;

				for (const dir of upperDirs) {
					if (!mentions(source, dir)) continue;
					context.report({ node, messageId: "upward", data: { dir } });
					return;
				}
			},
		};
	},
});
