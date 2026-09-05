import { getLankaFlags } from "lanka/config";
import { createLankaDevtoolsPanelView } from "./_internal/create-lanka-devtools-panel-view/createLankaDevtoolsPanelView";
import type { TLankaDevtoolsPanelTab } from "./_internal/lanka-devtools-panel-rows/lankaDevtoolsPanelRows";
import type { ILankaDevtoolsSnapshot } from "../lanka-devtools-collector/LankaDevtoolsCollector";

export interface ILankaDevtoolsPanelOptions {
	/** Where to mount. `document.body` by default. */
	container?: Element;
	/** Which list to open on. Events by default. */
	tab?: TLankaDevtoolsPanelTab;
	/** Start as a title bar. Open by default. */
	collapsed?: boolean;
	/**
	 * How the panel learns something changed — `devtools.subscribe`.
	 *
	 * Without it the panel falls back to redrawing twice a second, which is what
	 * it did before there was anything to subscribe to. That fallback is why the
	 * option is optional: a call written against the old signature keeps working
	 * and keeps looking the same.
	 */
	subscribe?: (listener: () => void) => () => void;
	/** What the clear button does. Absent, there is no clear button. */
	onClear?: () => void;
}

const POLL_INTERVAL_MS = 500;

/**
 * Renders the inspector panel and returns a function that tears it down.
 *
 * ## Why `undefined` outside development
 *
 * A function returning `undefined` before doing any work lets the consumer's
 * bundler remove its body and everything it references. A panel in a production
 * build is not a little extra code but an interface that can appear on a user's
 * screen.
 *
 * ## Why DOM rather than React
 *
 * The package has no opinion about what a consumer renders their interface with.
 * This panel is the only place anything is rendered at all, and a view-library
 * dependency for it would be paid for by every application that installs a debug
 * tool.
 *
 * ## Why it grew
 *
 * It used to be thirty lines showing the last twenty events, and the package's
 * own maintenance skill called growing it a trap. That rule guarded against a
 * view dependency and a product surface, and it produced neither — what it
 * produced was a panel nobody opened, because the logs and the requests were
 * only reachable by writing a debug screen of your own, which is a project
 * nobody starts while debugging. The guard now sits where the risk actually is:
 * no view library, nothing outside development, and no writing back into the
 * framework.
 */
export const renderLankaDevtoolsPanel = (
	getSnapshot: () => ILankaDevtoolsSnapshot,
	optionsOrContainer?: Element | ILankaDevtoolsPanelOptions,
): (() => void) | undefined => {
	if (getLankaFlags().isDevelopment !== true) return undefined;
	if (typeof document === "undefined") return undefined;

	const options = asOptions(optionsOrContainer);
	const view = createLankaDevtoolsPanelView({
		getSnapshot,
		tab: options.tab ?? "events",
		collapsed: options.collapsed ?? false,
		onClear: options.onClear,
	});

	(options.container ?? document.body).appendChild(view.element);
	const stopWatching = watch(options.subscribe, view.update);

	return () => {
		stopWatching();
		view.element.remove();
	};
};

/**
 * The second parameter, either way it was written.
 *
 * The `container` position is still accepted because a published signature is
 * not taken back — `skills/surface/SKILL.md` §6c.
 */
const asOptions = (
	optionsOrContainer: Element | ILankaDevtoolsPanelOptions | undefined,
): ILankaDevtoolsPanelOptions => {
	if (optionsOrContainer === undefined) return {};
	if (typeof Element !== "undefined" && optionsOrContainer instanceof Element) {
		return { container: optionsOrContainer };
	}

	return optionsOrContainer as ILankaDevtoolsPanelOptions;
};

/**
 * Redraw on a change, coalesced to one animation frame.
 *
 * The collector already coalesces to a microtask; this is the second half, and
 * it is the half that matters when the changes are spread across turns. A panel
 * that redrew per event would make reading it the reason the application is
 * slow.
 */
const watch = (
	subscribe: ((listener: () => void) => () => void) | undefined,
	redraw: () => void,
): (() => void) => {
	if (!subscribe) {
		const timer = setInterval(redraw, POLL_INTERVAL_MS);
		return () => {
			clearInterval(timer);
		};
	}

	let queued = false;
	const stop = subscribe(() => {
		if (queued) return;

		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			redraw();
		});
	});

	return stop;
};
