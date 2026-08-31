import { LankaRingBuffer } from "../ring-buffer/LankaRingBuffer";
import type { ILankaLoggerSink } from "lanka/logger";

/** One event that passed through the bus. */
export interface ILankaDevtoolsEvent {
	at: number;
	eventType: string;
	/** How many subscribers there were at dispatch time. */
	subscribers: number;
	/** Who stopped delivery, if it was stopped. */
	stoppedBy?: string;
}

/** One log line. */
export interface ILankaDevtoolsLogLine {
	at: number;
	layer: string;
	level: string;
	message: string;
}

export interface ILankaDevtoolsSnapshot {
	events: readonly ILankaDevtoolsEvent[];
	logs: readonly ILankaDevtoolsLogLine[];
	/** How many requests are on the wire right now. */
	inFlight: number;
}

export interface ILankaDevtoolsCollectorConfig {
	/** How many recent events to keep. Defaults to 100. */
	maxEvents?: number;
	/** How many recent log lines to keep. Defaults to 200. */
	maxLogs?: number;
	/** Clock, so a test can move time. */
	clock?: () => number;
}

/**
 * Collecting history for the inspector.
 *
 * ## Its own source, not someone else's side effect
 *
 * Reading the bus's always-on buffer would make the inspector depend on a leak:
 * up to a hundred payloads per event type living for the whole session. The
 * inspector therefore has its OWN source, enabled together with it — collecting
 * "just in case" is the same defect under another name.
 */
export class LankaDevtoolsCollector {
	private readonly events: LankaRingBuffer<ILankaDevtoolsEvent>;
	private readonly logs: LankaRingBuffer<ILankaDevtoolsLogLine>;
	private readonly clock: () => number;
	private inFlight = 0;

	public constructor(config: ILankaDevtoolsCollectorConfig = {}) {
		this.events = new LankaRingBuffer(config.maxEvents ?? 100);
		this.logs = new LankaRingBuffer(config.maxLogs ?? 200);
		this.clock = config.clock ?? (() => Date.now());
	}

	public recordEvent(event: Omit<ILankaDevtoolsEvent, "at">): void {
		this.events.push({ ...event, at: this.clock() });
	}

	public setInFlight(count: number): void {
		this.inFlight = count;
	}

	/** The logger sink: lines arrive here exactly as they do at the console. */
	public createLoggerSink(): ILankaLoggerSink {
		return {
			emit: (entry) => {
				this.logs.push({
					at: this.clock(),
					layer: entry.layer,
					level: entry.level,
					message: typeof entry.message === "string" ? entry.message : "(function)",
				});
			},
		};
	}

	public getSnapshot(): ILankaDevtoolsSnapshot {
		return {
			events: this.events.toArray(),
			logs: this.logs.toArray(),
			inFlight: this.inFlight,
		};
	}

	public clear(): void {
		this.events.clear();
		this.logs.clear();
	}
}
