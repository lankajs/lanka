import { getLankaHost } from "../../../config/get-lanka-host/getLankaHost";
import { LankaError } from "../../lanka-error/LankaError";

/**
 * A server failure, named by kind.
 *
 * `http`, not `domain`: core sees only the status and the text. The domain
 * failure code — what the application branches on — is extracted from the body by
 * `@lankajs/plugin-http`, because body formats differ per backend and that is
 * policy, not framework.
 */
export const createLankaApiError = (
	status: number,
	errors: string[],
	body?: unknown,
): LankaError => {
	const errorMessage =
		errors.length > 0 && errors[0] ? errors[0] : getLankaHost().httpErrorMessage(status);

	return new LankaError({
		kind: "http",
		message: errorMessage,
		status,
		issues: errors.length > 0 ? errors : [errorMessage],
		body,
	});
};
