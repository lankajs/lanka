import { lankaArkTypeValidator } from "../../src/index";
import { playgroundFlagSchema } from "../playground-flag-schema/playgroundFlagSchema";
import type { IPlaygroundFeatureFlag } from "../_interfaces/IPlaygroundFeatureFlag";

/**
 * A gateway, which is where the guides say validation belongs.
 *
 * The six packages in this family are shown in six different consumer shapes on
 * purpose: a form, a screen, a list, a config reader, a gateway. Six copies of
 * one form would say only that the packages are interchangeable, which the
 * conformance suite already proves — and `check:composition` would call the
 * sixth copy what it is.
 *
 * A gateway is where a body stops being `unknown`, so this one uses the STRICT
 * path: a response that fails is a broken contract, not a branch. The label is
 * what turns "invalid response" into "which call".
 */
export const createPlaygroundFeatureGateway = () => ({
	/** The contract path: a flag the backend promised and did not send is a bug. */
	read: (body: unknown): IPlaygroundFeatureFlag =>
		lankaArkTypeValidator.validate<IPlaygroundFeatureFlag>(
			playgroundFlagSchema,
			body,
			"flags.byKey",
		),

	/**
	 * The optional path: a flag the backend may legitimately not know.
	 *
	 * Not `validate` in a `try`: a catch around a contract failure cannot tell
	 * "this flag is unset" from "the payload changed shape", and the gateway is
	 * the one place that distinction is still available.
	 */
	readOptional: (body: unknown): IPlaygroundFeatureFlag | null => {
		const result = lankaArkTypeValidator.validateSafe<IPlaygroundFeatureFlag>(
			playgroundFlagSchema,
			body,
		);

		return result.success ? result.data : null;
	},
});
