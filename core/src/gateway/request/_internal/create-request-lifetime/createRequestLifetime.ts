import { createLankaForegroundDeadline } from "../../../../_internal/create-lanka-foreground-deadline/createLankaForegroundDeadline";

export interface IRequestLifetime {
	readonly signal: AbortSignal | undefined;
	/** Whether OUR timer aborted the request rather than the caller. */
	timedOut(): boolean;
	/** Whether the page was SEEN to hide, or to unload, while the attempt lived. */
	wasHidden(): boolean;
	dispose(): void;
}

const NO_LIFETIME: IRequestLifetime = Object.freeze({
	signal: undefined,
	timedOut: () => false,
	wasHidden: () => false,
	dispose: () => undefined,
});

/**
 * Combines the caller's signal, our own deadline and the page's visibility into
 * one request lifetime.
 *
 * The outcome looks the same — an interrupted request — but the decisions
 * differ: a timeout is shown and offered for retry, a user cancellation is not
 * shown at all. `AbortSignal` does not distinguish them: one `abort`, whose
 * reason belongs to whoever got there first. Hence the private flag.
 *
 * Not `AbortSignal.timeout` alone: it cannot combine with a foreign signal
 * without `AbortSignal.any`, which older engines lack, and it cannot stop while
 * the app is in the background — see `createLankaForegroundDeadline`.
 */
export function createRequestLifetime(
	external: AbortSignal | undefined,
	timeoutMs: number | undefined,
): IRequestLifetime {
	const followsPage = typeof document !== "undefined";
	if (!external && !timeoutMs && !followsPage) return NO_LIFETIME;

	// No signal is produced when the caller gave none and set no deadline: "no
	// options" and "empty options" are different statements to a transport.
	const controller = external || timeoutMs ? new AbortController() : undefined;
	const deadline = createLankaForegroundDeadline(controller ? timeoutMs : undefined, () => {
		controller?.abort(new DOMException("Request timed out", "TimeoutError"));
	});

	const onExternalAbort = (): void => {
		controller?.abort(external?.reason);
	};
	if (external) {
		if (external.aborted) onExternalAbort();
		else external.addEventListener("abort", onExternalAbort, { once: true });
	}

	return {
		signal: controller?.signal,
		timedOut: () => deadline.expired(),
		wasHidden: () => deadline.wasHidden(),
		dispose: () => {
			deadline.clear();
			external?.removeEventListener("abort", onExternalAbort);
		},
	};
}
