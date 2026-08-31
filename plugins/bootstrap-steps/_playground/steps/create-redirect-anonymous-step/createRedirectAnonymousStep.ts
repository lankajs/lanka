import type { ILankaBootstrapStepConfig } from "../../../src/index";
import type { IPlaygroundContext } from "../../_interfaces/IPlaygroundContext";

/**
 * The step the plugin exists for: an early exit that is a DECISION.
 *
 * An unauthenticated visitor is not an error anywhere. Throwing here would be
 * reported as a broken start-up, and the sequence would lose the one thing it
 * knows — where the visitor belongs instead.
 */
export const createRedirectAnonymousStep = (): ILankaBootstrapStepConfig<IPlaygroundContext> => ({
	name: "redirect-anonymous",
	run: (context) => {
		const visited = [...context.visited, "redirect-anonymous"];
		if (context.token) return { ...context, visited };

		return { ...context, done: true, redirectTo: "/sign-in", visited };
	},
});
