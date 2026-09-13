import { createLankaHost } from "lanka/config";
import type { ILankaHost } from "lanka/config";

/** The status at and above which the server could not answer rather than would not. */
const SERVER_FAULT = 500;

/**
 * The four things the framework cannot decide for this application.
 *
 * All four are required by the contract on purpose: the copy is a product
 * decision and the base URL is a build's, so a missing one is a compile error in
 * the single place a host is passed rather than an `undefined` inside a URL.
 *
 * A unit of its own rather than an object literal inside the start-up function,
 * because these sentences are the ones a person reads when something goes wrong
 * — and a sentence nothing can test is a sentence nobody checked.
 */
export const createAtlasHost = (apiBaseUrl: string): ILankaHost =>
	createLankaHost({
		apiBaseUrl,
		httpErrorMessage: (status) =>
			// The two halves of "the server said no" need different words: one is
			// worth trying again and the other is not.
			status >= SERVER_FAULT ? "Atlas is not answering" : "Atlas refused that",
		networkErrorMessage: () => "No connection to Atlas",
		timeoutErrorMessage: () => "Atlas took too long",
	});
