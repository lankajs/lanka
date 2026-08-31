import { getLankaFlags } from "lanka/config";
import { lankaLogger } from "lanka/logger";
import type { ILankaPlugin } from "lanka";
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
}

export interface ILankaDevtoolsPlugin extends ILankaPlugin {
	/** What has been collected so far. Empty when the inspector is disabled. */
	getSnapshot: () => ILankaDevtoolsSnapshot;
	/** Whether collection is on. */
	isEnabled: () => boolean;
}

const EMPTY_SNAPSHOT: ILankaDevtoolsSnapshot = { events: [], logs: [], inFlight: 0 };

/**
 * The inspector plugin.
 *
 * A disabled inspector accumulates NOTHING — its main property, pinned by its
 * own test. Outside development it subscribes to nothing and returns an empty
 * snapshot, so the consumer's bundler removes it and everything behind it.
 */
export const lankaDevtools = (config: ILankaDevtoolsConfig = {}): ILankaDevtoolsPlugin => {
	const enabled = config.enabled ?? getLankaFlags().isDevelopment === true;
	const collector = enabled ? new LankaDevtoolsCollector(config) : null;

	return {
		name: "@lankajs/plugin-devtools",
		isEnabled: () => enabled,
		getSnapshot: () => collector?.getSnapshot() ?? EMPTY_SNAPSHOT,
		install(lanka) {
			if (!collector) return undefined;

			const sink = collector.createLoggerSink();
			lankaLogger.addSink(sink);

			lanka.eventBus.addMiddleware((eventType) => {
				collector.recordEvent({
					eventType,
					subscribers: lanka.eventBus.getSubscriptions(eventType),
				});
				// The inspector OBSERVES and does not decide: middleware able to stop
				// delivery would turn a diagnostic tool into a participant, and
				// "disabled the inspector, it started working" would become a possible
				// sentence.
				return "pass";
			});

			const unsubscribeInFlight = lanka.inFlight.subscribe((count) => {
				collector.setInFlight(count);
			});

			return () => {
				unsubscribeInFlight();
				lankaLogger.removeSink(sink);
				collector.clear();
			};
		},
	};
};
