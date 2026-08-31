import type { ILankaBootstrapStepConfig } from "../../../src/index";
import type { IPlaygroundBackend } from "../../_interfaces/IPlaygroundBackend";
import type { IPlaygroundContext } from "../../_interfaces/IPlaygroundContext";

/**
 * Optional, and on a deadline.
 *
 * Analytics failing at start-up must not take sign-in down with it, and a step
 * that never settles holds bootstrap forever: failing is more honest than
 * waiting.
 */
export const createAnalyticsStep = (
	backend: IPlaygroundBackend,
): ILankaBootstrapStepConfig<IPlaygroundContext> => ({
	name: "analytics",
	optional: true,
	timeoutMs: 50,
	run: async (context) => {
		if (backend.analyticsDelayMs) {
			await new Promise((resolve) => setTimeout(resolve, backend.analyticsDelayMs));
		}
		if (backend.analyticsFails) throw new Error("analytics down");

		return {
			...context,
			analyticsReady: true,
			visited: [...context.visited, "analytics"],
		};
	},
});
