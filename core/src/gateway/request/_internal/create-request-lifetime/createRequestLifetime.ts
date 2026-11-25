export interface IRequestLifetime {
	readonly signal: AbortSignal | undefined;
	/** Whether OUR timer aborted the request rather than the caller. */
	timedOut(): boolean;
	/** Whether the page was SEEN to hide, or to unload, while the attempt lived. */
	wasHidden(): boolean;
	dispose(): void;
}

interface IVisibleDeadline {
	pause(): void;
	resume(): void;
	clear(): void;
}

const NO_LIFETIME: IRequestLifetime = Object.freeze({
	signal: undefined,
	timedOut: () => false,
	wasHidden: () => false,
	dispose: () => undefined,
});

/**
 * `"hidden"` exactly. A test runner's DOM may answer `"prerender"`, and a
 * deadline paused there would never fire in anybody's suite.
 */
const isPageHidden = (): boolean =>
	typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * A timer that stops counting while the page is seen hidden.
 *
 * A mobile WebView is FROZEN when the user leaves it — an external link, an app
 * switch, a locked screen — and timers do not run while it is. An overdue timer
 * fires at once on resume, so a plain `setTimeout` reported a timeout for a
 * request that was never slow: the minute the page spent frozen was counted as
 * the server's. The remainder is computed when the page HIDES, which is the last
 * moment the clock is still honest.
 *
 * It always STARTS. A page already hidden when the attempt begins is not trusted
 * to say `visible` again — some WebViews report `hidden` from load and never
 * change it, an Electron window may never be shown — and a clock that waited for
 * it would make the caller's deadline mean nothing there. Only a hide seen while
 * the attempt lives pauses it.
 */
function createVisibleDeadline(timeoutMs: number, onExpire: () => void): IVisibleDeadline {
	let remainingMs = timeoutMs;
	let startedAt = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let cleared = false;

	const pause = (): void => {
		if (timer === undefined) return;
		clearTimeout(timer);
		timer = undefined;
		remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt));
	};
	const resume = (): void => {
		if (timer !== undefined || cleared) return;
		startedAt = Date.now();
		timer = setTimeout(() => {
			cleared = true;
			onExpire();
		}, remainingMs);
	};
	const clear = (): void => {
		cleared = true;
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
	};

	resume();
	return { pause, resume, clear };
}

/**
 * Follows the page for one attempt: whether it hid, and the deadline with it.
 *
 * `pagehide` beside `visibilitychange`: a page unloaded under its own requests
 * — the host relaunching the web app — cuts their fetches, and they come back as
 * `network` with nothing to tell them from a dropped connection. And `pageshow`
 * to resume: a page restored from the back/forward cache by an engine that
 * sends no `visibilitychange` would otherwise stay paused.
 */
function watchPage(deadline: IVisibleDeadline | undefined, onHide: () => void): () => void {
	if (typeof document === "undefined" || typeof window === "undefined") return () => undefined;

	const onVisibility = (): void => {
		if (isPageHidden()) {
			onHide();
			deadline?.pause();
		} else deadline?.resume();
	};
	const onPageHide = (): void => {
		onHide();
		deadline?.pause();
	};
	const onPageShow = (): void => {
		if (!isPageHidden()) deadline?.resume();
	};

	document.addEventListener("visibilitychange", onVisibility);
	window.addEventListener("pagehide", onPageHide);
	window.addEventListener("pageshow", onPageShow);
	return () => {
		document.removeEventListener("visibilitychange", onVisibility);
		window.removeEventListener("pagehide", onPageHide);
		window.removeEventListener("pageshow", onPageShow);
	};
}

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
 * without `AbortSignal.any`, which older engines lack, and it cannot pause.
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
	let expired = false;
	let hidden = false;

	const deadline =
		controller && timeoutMs !== undefined
			? createVisibleDeadline(timeoutMs, () => {
					expired = true;
					controller.abort(new DOMException("Request timed out", "TimeoutError"));
				})
			: undefined;
	const unwatch = watchPage(deadline, () => {
		hidden = true;
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
		timedOut: () => expired,
		wasHidden: () => hidden,
		dispose: () => {
			deadline?.clear();
			unwatch();
			external?.removeEventListener("abort", onExternalAbort);
		},
	};
}
