import { getLankaFlags } from "lanka/config";
import type { ILankaDevtoolsSnapshot } from "../collector/LankaDevtoolsCollector";

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
 * The package has no opinion about what a consumer renders its interface with.
 * This panel is the only place anything is rendered at all, and a view-library
 * dependency for it would cost more than thirty lines of node creation.
 */
export const renderLankaDevtoolsPanel = (
	getSnapshot: () => ILankaDevtoolsSnapshot,
	container?: Element,
): (() => void) | undefined => {
	if (getLankaFlags().isDevelopment !== true) return undefined;
	if (typeof document === "undefined") return undefined;

	const host = container ?? document.body;
	const panel = document.createElement("div");
	panel.dataset.lankaDevtools = "";
	panel.style.cssText =
		"position:fixed;right:8px;bottom:8px;z-index:2147483647;max-width:360px;" +
		"max-height:50vh;overflow:auto;background:#111;color:#eee;font:12px/1.4 monospace;" +
		"padding:8px;border-radius:6px;opacity:.92";

	const render = (): void => {
		const snapshot = getSnapshot();
		panel.textContent = "";

		panel.appendChild(line(`in flight: ${String(snapshot.inFlight)}`));
		panel.appendChild(line(`events: ${String(snapshot.events.length)}`));

		// Newest first: an inspector is read when something has just happened.
		for (const event of [...snapshot.events].reverse().slice(0, 20)) {
			panel.appendChild(
				line(
					`${event.eventType} → ${String(event.subscribers)}` +
						(event.stoppedBy === undefined ? "" : ` (stopped by: ${event.stoppedBy})`),
				),
			);
		}
	};

	render();
	host.appendChild(panel);
	const timer = setInterval(render, 500);

	return () => {
		clearInterval(timer);
		panel.remove();
	};
};

const line = (text: string): HTMLElement => {
	const element = document.createElement("div");
	element.textContent = text;
	return element;
};
