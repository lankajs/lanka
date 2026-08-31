import type { ILankaHost } from "lanka/config";

/**
 * The host a spec supplies when it is not the subject of the test.
 *
 * A host is REQUIRED in the framework config: it cannot know how an application
 * phrases a network failure or where its API lives, and being wrong about that
 * must be loud rather than silently defaulted.
 *
 * A spec that is actually ABOUT the host builds its own stub and asserts what
 * was asked of it.
 */
export const lankaTestHost: ILankaHost = Object.freeze({
	apiBaseUrl: "https://api.test",
	httpErrorMessage: (status: number): string => `Request failed with status ${status}`,
	networkErrorMessage: (): string => "Network error",
	timeoutErrorMessage: (): string => "Request timed out",
});
