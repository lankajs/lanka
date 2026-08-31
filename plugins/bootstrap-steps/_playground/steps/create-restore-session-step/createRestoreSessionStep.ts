import type { ILankaBootstrapStepConfig } from "../../../src/index";
import type { IPlaygroundBackend } from "../../_interfaces/IPlaygroundBackend";
import type { IPlaygroundContext } from "../../_interfaces/IPlaygroundContext";

/** First: whatever the last session left behind. */
export const createRestoreSessionStep = (
	backend: IPlaygroundBackend,
): ILankaBootstrapStepConfig<IPlaygroundContext> => ({
	name: "restore-session",
	run: (context) => ({
		...context,
		token: backend.token,
		visited: [...context.visited, "restore-session"],
	}),
});
