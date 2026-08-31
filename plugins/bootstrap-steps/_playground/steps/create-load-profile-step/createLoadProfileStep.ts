import type { ILankaBootstrapStepConfig } from "../../../src/index";
import type { IPlaygroundBackend } from "../../_interfaces/IPlaygroundBackend";
import type { IPlaygroundContext } from "../../_interfaces/IPlaygroundContext";

/**
 * Required: without a profile there is no screen to land on.
 *
 * It is reached only by a visitor the previous step let through, which is what
 * makes "the anonymous visitor never loads a profile" observable.
 */
export const createLoadProfileStep = (
	backend: IPlaygroundBackend,
): ILankaBootstrapStepConfig<IPlaygroundContext> => ({
	name: "load-profile",
	run: (context) => {
		if (backend.profileFails) throw new Error("profile unavailable");

		return {
			...context,
			profile: { name: "Ada" },
			visited: [...context.visited, "load-profile"],
		};
	},
});
