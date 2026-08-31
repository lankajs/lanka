import type { ILankaHost } from "lanka";

/**
 * What this app supplies to `lanka`.
 *
 * The framework ships the layers and deliberately knows neither where this app
 * talks to, how it phrases a failure, nor how it phrases a timeout. Every
 * field is required, so that it is wrong loudly rather than defaulted quietly.
 */
export const lankaHost: ILankaHost = {
	apiBaseUrl: "/api",
	httpErrorMessage: (status: number): string => `Request failed with status ${status}`,
	networkErrorMessage: (): string => "Network error",
	timeoutErrorMessage: (): string => "Request timed out",
};
