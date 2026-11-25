export interface ILankaForegroundDeadline {
	/** Whether the deadline ran out. */
	expired(): boolean;
	/** Whether the page was SEEN to hide, or to unload, while the deadline lived. */
	wasHidden(): boolean;
	/** Stops the clock and the page watch. Safe to call twice, and after expiry. */
	clear(): void;
}

interface IPausableClock {
	pause(): void;
	resume(): void;
	clear(): void;
}

/**
 * `"hidden"` exactly. A test runner's DOM may answer `"prerender"`, and a clock
 * paused there would never run out in anybody's suite.
 */
const isPageHidden = (): boolean =>
	typeof document !== "undefined" && document.visibilityState === "hidden";

/** A `setTimeout` that can stop and go on with what was left. */
function startPausableClock(timeoutMs: number, onExpire: () => void): IPausableClock {
	let remainingMs = timeoutMs;
	let startedAt = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let done = false;

	const pause = (): void => {
		if (timer === undefined) return;
		clearTimeout(timer);
		timer = undefined;
		remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt));
	};
	const resume = (): void => {
		if (timer !== undefined || done) return;
		startedAt = Date.now();
		timer = setTimeout(() => {
			done = true;
			onExpire();
		}, remainingMs);
	};
	const clear = (): void => {
		done = true;
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
	};

	resume();
	return { pause, resume, clear };
}

/**
 * Follows the page: a hide pauses the clock, a show resumes it.
 *
 * `pagehide` beside `visibilitychange`: a page unloaded by its host cuts what
 * it was waiting for. And `pageshow` to resume: a page restored from the
 * back/forward cache by an engine that sends no `visibilitychange` would
 * otherwise stay paused.
 */
function watchPage(clock: IPausableClock | undefined, onHide: () => void): () => void {
	if (typeof document === "undefined" || typeof window === "undefined") return () => undefined;

	const hide = (): void => {
		onHide();
		clock?.pause();
	};
	const onVisibility = (): void => {
		if (isPageHidden()) hide();
		else clock?.resume();
	};
	const onPageShow = (): void => {
		if (!isPageHidden()) clock?.resume();
	};

	document.addEventListener("visibilitychange", onVisibility);
	window.addEventListener("pagehide", hide);
	window.addEventListener("pageshow", onPageShow);
	return () => {
		document.removeEventListener("visibilitychange", onVisibility);
		window.removeEventListener("pagehide", hide);
		window.removeEventListener("pageshow", onPageShow);
	};
}

/**
 * A deadline that stops while the app is in the background.
 *
 * A mobile WebView is FROZEN when the user leaves it — an external link, an app
 * switch, a locked screen — and timers do not run while it is. An overdue timer
 * fires at once on resume, so a plain `setTimeout` declared "too slow" what was
 * merely frozen: a request that was never slow ended as `timeout`, a start-up
 * service failed the boot, an optimistic change rolled back. The remainder is
 * computed when the page HIDES, the last moment the clock is still honest.
 *
 * It always STARTS. A page already hidden when the deadline begins is not
 * trusted to say `visible` again — some WebViews report `hidden` from load and
 * never change it, an Electron window may never be shown — and a clock that
 * waited for it would make the deadline mean nothing there. Only a hide SEEN
 * while it lives pauses it.
 *
 * `timeoutMs` undefined: no clock, only the page watch, for a caller that needs
 * `wasHidden` without a deadline. No `document` (Node, SSR, React Native): a
 * plain timer.
 *
 * In `lanka/internal` because three places need the same clock — the request
 * lifetime, start-up services and `@lankajs/optimistic`'s lock — and a copy is
 * one more place for the frozen-WebView defect to come back.
 */
export function createLankaForegroundDeadline(
	timeoutMs: number | undefined,
	onExpire: () => void,
): ILankaForegroundDeadline {
	let expired = false;
	let hidden = false;
	const clock =
		timeoutMs === undefined
			? undefined
			: startPausableClock(timeoutMs, () => {
					expired = true;
					onExpire();
				});
	const unwatch = watchPage(clock, () => {
		hidden = true;
	});

	return {
		expired: () => expired,
		wasHidden: () => hidden,
		clear: () => {
			clock?.clear();
			unwatch();
		},
	};
}
