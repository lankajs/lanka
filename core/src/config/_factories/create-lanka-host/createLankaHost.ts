import type { ILankaHost } from "../../_interfaces/ILankaHost";

/** A host built from as much or as little as an application wants to say. */
export interface ILankaHostConfig extends Partial<Omit<ILankaHost, "apiBaseUrl">> {
	/**
	 * A prefix put in front of every path a gateway builds. Empty by default.
	 *
	 * Omit it when there is nothing sensible to put there: an application served
	 * from the same origin as its API, or one talking to several APIs whose
	 * gateways write whole URLs themselves. An empty base is not a guess — it
	 * means "no prefix", and `endpoint()` then answers the path as written.
	 *
	 * What is deliberately NOT here is a guessed default like `/api`: that would
	 * be silently wrong for every application that does not use it, and the
	 * symptom is a 404 three layers from the cause.
	 */
	apiBaseUrl?: string;
}

/**
 * What an application gets for every field it did not write: no prefix, and
 * English copy.
 *
 * Separate from the factory so they can be read: what a consumer is accepting by
 * omitting a field is visible here rather than buried in a `??` chain.
 */
const DEFAULTS = {
	apiBaseUrl: "",
	httpErrorMessage: (status: number): string => `Request failed with status ${status}`,
	networkErrorMessage: (): string => "Network error",
	timeoutErrorMessage: (): string => "Request timed out",
};

/**
 * A complete host from as little as nothing at all.
 *
 * ## Why `ILankaHost` still requires all four
 *
 * The interface is strict on purpose: a missing message factory means a
 * wrong-language string in somebody's interface, and that must be a compile
 * error in the one place a host is passed rather than a surprise in production.
 *
 * This factory does not weaken that — it is the OPT-IN. Calling it is a visible
 * act that says "English is fine for now", and what you accepted is three lines
 * above this comment. A default on the interface would say the same thing
 * silently, to everyone, forever.
 *
 * ```ts
 * createLankaHost(); // no prefix, English copy
 * createLankaHost({ apiBaseUrl: "https://api.example.com" });
 * createLankaHost({ networkErrorMessage: () => "No connection" });
 * ```
 */
export const createLankaHost = (config: ILankaHostConfig = {}): ILankaHost => ({
	// Field by field rather than a spread: a caller passing its own optional
	// config forwards `{ apiBaseUrl: undefined }`, and a spread would overwrite
	// the default with that — a host whose base URL is `undefined`, which reaches
	// a request URL as the string "undefined". Absent and undefined mean the same
	// thing here, and only this shape says so.
	apiBaseUrl: config.apiBaseUrl ?? DEFAULTS.apiBaseUrl,
	httpErrorMessage: config.httpErrorMessage ?? DEFAULTS.httpErrorMessage,
	networkErrorMessage: config.networkErrorMessage ?? DEFAULTS.networkErrorMessage,
	timeoutErrorMessage: config.timeoutErrorMessage ?? DEFAULTS.timeoutErrorMessage,
});
