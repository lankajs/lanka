import { createLanka } from "lanka";
import { lankaBootstrapSteps } from "../../src/index";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createAnalyticsStep } from "../steps/create-analytics-step/createAnalyticsStep";
import { createLoadProfileStep } from "../steps/create-load-profile-step/createLoadProfileStep";
import { createRedirectAnonymousStep } from "../steps/create-redirect-anonymous-step/createRedirectAnonymousStep";
import { createRestoreSessionStep } from "../steps/create-restore-session-step/createRestoreSessionStep";
import type { ILankaInstance } from "lanka";
import type { IPlaygroundBackend } from "../_interfaces/IPlaygroundBackend";
import type { IPlaygroundContext } from "../_interfaces/IPlaygroundContext";

/** A started application whose start-up sequence is the plugin's. */
export interface IPlaygroundBootstrapApp {
	lanka: ILankaInstance;
	run: () => Promise<IPlaygroundContext>;
}

/**
 * The same sequence, installed as a PLUGIN rather than held by hand.
 *
 * This is how an application uses the package: the pipeline arrives with the
 * instance, and removing the plugin resets it. Holding the pipeline directly —
 * what the other scenes do — is the testable half; this is the wiring a consumer
 * writes once, and the reason the package is a plugin at all.
 */
export const startPlaygroundBootstrap = (backend: IPlaygroundBackend): IPlaygroundBootstrapApp => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const plugin = lankaBootstrapSteps<IPlaygroundContext>({
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

	lanka.use(plugin);

	return { lanka, run: () => plugin.pipeline.run() };
};
