import { getLankaFlags } from "lanka/config";
import { lankaLogger } from "lanka/logger";
import { lankaEventBus } from "lanka/scenario";
import type { ILankaPlugin } from "lanka";
import type { ILankaRequestContext } from "lanka/gateway";
import {
	LankaDevtoolsCollector,
	type ILankaDevtoolsCollectorConfig,
	type ILankaDevtoolsSnapshot,
} from "../collector/LankaDevtoolsCollector";

export interface ILankaDevtoolsConfig extends ILankaDevtoolsCollectorConfig {
	/**
	 * Whether the inspector is enabled. Development only by default.
	 *
	 * An explicit value is needed by exactly one caller: a test that wants to look
	 * at what was collected.
	 */
	enabled?: boolean;
	/**
	 * A global name to reach the inspector by from the browser console.
	 *
	 * A NAME rather than a flag: `expose: true` cannot grow a second question, and
	 * what a console user actually needs to know is what to type. Removed again on
	 * teardown, and never set while the inspector is disabled.
	 */
	exposeAs?: string;
}

export interface ILankaDevtoolsPlugin extends ILankaPlugin {
	/** What has been collected so far. Empty when the inspector is disabled. */
	getSnapshot: () => ILankaDevtoolsSnapshot;
	/** Whether collection is on. */
	isEnabled: () => boolean;
	/**
	 * Forgets everything collected so far, and keeps collecting.
	 *
	 * What a developer reaches for before reproducing something: a panel showing
	 * the last ten minutes of an unrelated session is a panel nobody reads.
	 */
	clear: () => void;
	/**
	 * Called when something new was collected. Returns a function that stops it.
	 *
	 * What a panel redraws on. Polling was the previous answer and it was wrong in
	 * both directions: a redraw twice a second when nothing happened, and half a
	 * second of staleness when something did.
	 *
	 * A disabled inspector returns a no-op, so a panel may subscribe
	 * unconditionally.
	 */
	subscribe: (listener: () => void) => () => void;
}

const EMPTY_SNAPSHOT: ILankaDevtoolsSnapshot = {
	events: [],
	logs: [],
	requests: [],
	scenarios: [],
	inFlight: 0,
};

/**
 * The inspector plugin.
 *
 * A disabled inspector accumulates NOTHING — its main property, pinned by its
 * own test. Outside development it subscribes to nothing and returns an empty
 * snapshot, so the consumer's bundler removes it and everything behind it.
 */
export const lankaDevtools = (config: ILankaDevtoolsConfig = {}): ILankaDevtoolsPlugin => {
	const enabled = config.enabled ?? getLankaFlags().isDevelopment === true;
	const collector = enabled
		? new LankaDevtoolsCollector({
				...config,
				readScenarios: config.readScenarios ?? readRegisteredScenarios,
			})
		: null;

	const plugin: ILankaDevtoolsPlugin = {
		name: "@lankajs/plugin-devtools",
		isEnabled: () => enabled,
		getSnapshot: () => collector?.getSnapshot() ?? EMPTY_SNAPSHOT,
		clear: () => collector?.clear(),
		subscribe: (listener) => collector?.subscribe(listener) ?? (() => undefined),
		install: (lanka) =>
			collector ? attach({ collector, lanka, plugin, exposeAs: config.exposeAs }) : undefined,
	};

	return plugin;
};

/**
 * Every source the inspector reads, attached at once — and the one function that
 * detaches all of them.
 *
 * One place rather than five, because the failure it prevents is asymmetric: a
 * source attached and not detached leaves a logger sink holding a collector
 * holding every line it ever saw, and nothing in the running application would
 * show it.
 */
const attach = (wiring: {
	collector: LankaDevtoolsCollector;
	lanka: Parameters<NonNullable<ILankaPlugin["install"]>>[0];
	plugin: ILankaDevtoolsPlugin;
	exposeAs: string | undefined;
}): (() => void) => {
	const { collector, lanka } = wiring;

	const sink = collector.createLoggerSink();
	lankaLogger.addSink(sink);

	datesEachDispatch(collector, lanka);

	// The sixth extension point, and the only source of `stoppedBy`: a middleware
	// sees only the chain before itself, and this one is registered first.
	const observer = collector.completeEvent.bind(collector);
	lanka.eventBus.addObserver(observer);

	const stopWatchingRequests = lanka.useRequestMiddleware(recordInto(collector));
	const stopWatchingInFlight = lanka.inFlight.subscribe((count) => {
		collector.setInFlight(count);
	});
	const unexpose = expose(wiring.exposeAs, wiring.plugin);

	return () => {
		unexpose();
		stopWatchingRequests();
		stopWatchingInFlight();
		lanka.eventBus.removeObserver(observer);
		lankaLogger.removeSink(sink);
		collector.clear();
	};
};

/**
 * Records a dispatch at the moment it STARTS.
 *
 * Never removed, because the bus has no `removeMiddleware` reachable from a
 * plugin's teardown — and it does not need one: the collector it writes into is
 * cleared, and a disposed instance takes its whole bus with it.
 *
 * It answers `"pass"` unconditionally. Middleware able to stop delivery would
 * turn a diagnostic tool into a participant, and "disabled the inspector, it
 * started working" would become a possible sentence.
 */
const datesEachDispatch = (
	collector: LankaDevtoolsCollector,
	lanka: Parameters<NonNullable<ILankaPlugin["install"]>>[0],
): void => {
	lanka.eventBus.addMiddleware((eventType) => {
		collector.recordEvent({
			eventType,
			subscribers: lanka.eventBus.getSubscriptions(eventType),
		});

		return "pass";
	});
};

/**
 * The event types the application declared, whether or not any has fired.
 *
 * "My scenario never fires" is the question the scenario list is opened for, and
 * it is exactly the case a list built from what HAPPENED cannot show.
 *
 * Read through the ambient bus and guarded: a snapshot may be asked for before
 * the instance is active — a panel mounting early, a test reading the plugin it
 * has not installed — and answering "no scenarios" is the honest answer there,
 * where throwing would make reading a diagnostic tool a way to crash.
 */
const readRegisteredScenarios = (): readonly { eventType: string; subscribers: number }[] => {
	try {
		return lankaEventBus.getRegisteredEvents().map((event) => ({
			eventType: event.eventType,
			subscribers: lankaEventBus.getSubscriptions(event.eventType),
		}));
	} catch {
		return [];
	}
};

/**
 * Times every request and records how it ended.
 *
 * It rethrows untouched. The inspector observes and does not decide, and this is
 * the second place that rule has to hold: a diagnostic wrapper that swallowed a
 * failure would make the application behave differently while being watched.
 *
 * Registered first, it wraps the retry policy rather than sitting inside it, so
 * one row is one call the application made — including whatever it took to
 * succeed.
 */
const recordInto =
	(collector: LankaDevtoolsCollector) =>
	async (ctx: ILankaRequestContext, next: (ctx: ILankaRequestContext) => Promise<unknown>) => {
		const startedAt = Date.now();

		try {
			const answer = await next(ctx);
			collector.recordRequest({
				endpoint: ctx.endpoint,
				durationMs: Date.now() - startedAt,
				outcome: "ok",
			});
			return answer;
		} catch (error) {
			collector.recordRequest({
				endpoint: ctx.endpoint,
				durationMs: Date.now() - startedAt,
				outcome: "failed",
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	};

/** Puts the inspector where a console can reach it, and takes it away again. */
const expose = (name: string | undefined, plugin: ILankaDevtoolsPlugin): (() => void) => {
	if (name === undefined || typeof globalThis === "undefined") return () => undefined;

	const target = globalThis as unknown as Record<string, unknown>;
	target[name] = plugin;

	return () => {
		delete target[name];
	};
};
