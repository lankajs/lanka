import { createLankaBootstrapPipeline } from "../../src/index";
import { createAnalyticsStep } from "../steps/create-analytics-step/createAnalyticsStep";
import { createLoadProfileStep } from "../steps/create-load-profile-step/createLoadProfileStep";
import { createRedirectAnonymousStep } from "../steps/create-redirect-anonymous-step/createRedirectAnonymousStep";
import { createRestoreSessionStep } from "../steps/create-restore-session-step/createRestoreSessionStep";
import type { IPlaygroundBackend } from "../_interfaces/IPlaygroundBackend";
import type { IPlaygroundContext } from "../_interfaces/IPlaygroundContext";

/**
 * The sequence itself: restore a session, load a profile, decide where to land.
 *
 * With every step in its own file this reads as the ORDER, which is the only
 * thing the pipeline owns. A step's own rules — required or optional, on a
 * deadline or not — are stated where the step is.
 */
export const createPlaygroundBootstrap = (backend: IPlaygroundBackend) =>
	createLankaBootstrapPipeline<IPlaygroundContext>({
		createContext: () => ({
			token: null,
			profile: null,
			analyticsReady: false,
			visited: [],
		}),

		steps: [
			createRestoreSessionStep(backend),
			createRedirectAnonymousStep(),
			createLoadProfileStep(backend),
			createAnalyticsStep(backend),
		],
	});
