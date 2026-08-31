import { requireActiveRuntime } from "../../../../_internal/active-runtime/activeRuntime";
import type { ILankaEventLog } from "../../../_interfaces/ILankaEventLog";
import type { ILankaEventMetadata } from "../../../_interfaces/ILankaEventMetadata";
import type { TLankaEventBusMiddleware } from "../../../_types/TLankaEventBusMiddleware";
import type { LankaEventBusInstance } from "../../lanka-event-bus-instance/LankaEventBusInstance";
import type { TLankaReplayRequest } from "../../lanka-event-bus-instance/LankaEventBusInstance";

/**
 * Ambient bus: the active instance's, reachable without holding it.
 *
 * Every member is one line of delegation and that is all this does. It exists
 * for callers that cannot hold an instance — a user-extended `ALankaScenario`,
 * the scenario bootstrap.
 *
 * An object rather than a class with a default instance, and the difference is
 * not cosmetic: this owns no state, so a second one would delegate to the same
 * runtime and be the same object under another name. Where an ambient DOES own
 * state — storage — the class is real and a second instance means something.
 *
 * Isolation belongs to the instance holder: `lanka.eventBus.dispatch(…)`. This
 * cannot offer it — by definition it serves the ONE active instance, so two
 * instances in one process share nothing through it.
 */
const bus = (): LankaEventBusInstance => requireActiveRuntime().eventBus;

export const lankaEventBus = Object.freeze({
	enableLogs: (): void => {
		bus().enableLogs();
	},

	disableLogs: (): void => {
		bus().disableLogs();
	},

	registerEvent: (eventType: string, metadata: ILankaEventMetadata): void => {
		bus().registerEvent(eventType, metadata);
	},

	getRegisteredEvents: () => bus().getRegisteredEvents(),

	getEventInfo: (eventType: string): ILankaEventMetadata | null => bus().getEventInfo(eventType),

	getSubscriptions: (eventType: string): number => bus().getSubscriptions(eventType),

	subscribe: <T>(
		eventType: string,
		callback: (data: T) => void,
		options?: { priority?: number; replay?: TLankaReplayRequest; usedBy?: string },
	): (() => void) => bus().subscribe(eventType, callback, options),

	unsubscribe: <T>(eventType: string, callback: (data: T) => void): void => {
		bus().unsubscribe(eventType, callback);
	},

	dispatch: <T>(eventType: string, data?: T, usedBy?: string): void => {
		bus().dispatch(eventType, data, usedBy);
	},

	addMiddleware: <T>(middleware: TLankaEventBusMiddleware<T>): void => {
		bus().addMiddleware(middleware);
	},

	removeMiddleware: <T>(middleware: TLankaEventBusMiddleware<T>): void => {
		bus().removeMiddleware(middleware);
	},

	getEventLogs: (eventType?: string, limit = 100): ILankaEventLog[] =>
		bus().getEventLogs(eventType, limit),

	clearEvent: (eventType: string): void => {
		bus().clearEvent(eventType);
	},

	clearAllEvents: (): void => {
		bus().clearAllEvents();
	},

	reset: (): void => {
		bus().reset();
	},
});
